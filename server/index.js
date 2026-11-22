import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use('/api', (_req,res,next) => { res.setHeader('Cache-Control','no-store'); next(); });
const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQL_USER,
  password: process.env.DB_PASS || process.env.MYSQL_PASSWORD,
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  // mysql2 parses MySQL JSON columns into objects by default. This API's row
  // mappers call JSON.parse(), so preserve the database JSON as text.
  jsonStrings: true,
});

const sessionSecret = process.env.SESSION_SECRET || process.env.ERP_JWT_SECRET;
const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || process.env.ERP_ADMIN_USER;
const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || process.env.ERP_ADMIN_PASSWORD;
if (!sessionSecret || !superAdminEmail || !superAdminPassword) {
  throw new Error('Set SESSION_SECRET, SUPER_ADMIN_EMAIL, and SUPER_ADMIN_PASSWORD (or the matching ERP_* variables).');
}
if (sessionSecret.length < 32 || superAdminPassword.length < 8 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(superAdminEmail)) {
  throw new Error('Use a 32+ character session secret, a valid super-admin email, and an 8+ character admin password.');
}
const cookieName = 'kbpos_session';
const sessionMaxAge = 7 * 24 * 60 * 60;
const signSession = (payload) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
};
function readSession(req) {
  const token = (req.headers.cookie || '').split(';').map((p) => p.trim()).find((p) => p.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!token) return null;
  const [encoded, signature] = decodeURIComponent(token).split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', sessionSecret).update(encoded).digest();
  let actual;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch { return null; }
}
function writeSession(req,res,user) {
  const token = signSession({ uid:user.id, role:user.sessionRole || user.role, shopId:user.shopId, staffId:user.staffId, pinVersion:user.pinVersion || null, exp:Math.floor(Date.now()/1000)+sessionMaxAge });
  res.cookie(cookieName, token, { httpOnly:true, secure:req.secure, sameSite:'lax', path:'/', maxAge:sessionMaxAge*1000 });
}
function clearSession(req,res) {
  res.clearCookie(cookieName, { httpOnly:true, secure:req.secure, sameSite:'lax', path:'/' });
}

async function ensureSuperAdmin() {
  const email = superAdminEmail.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(superAdminPassword, 12);
  await pool.execute(`INSERT INTO kb_users(id,email,display_name,password_hash,role,status)
    VALUES(?,?,?,?, 'super_admin','active') ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),password_hash=VALUES(password_hash),role='super_admin',status='active'`,
  [crypto.randomUUID(),email,'Super Admin',passwordHash]);
}
const authRateWindows = new Map();
function limitAuthAttempts(req,res,next) {
  const now=Date.now(), key=req.ip;
  const bucket=authRateWindows.get(key);
  if(!bucket || now-bucket.started>15*60*1000) authRateWindows.set(key,{started:now,count:1});
  else if(bucket.count>=30) return res.status(429).json({error:'অনেকবার চেষ্টা হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।'});
  else bucket.count++;
  if(authRateWindows.size>5000) for(const [ip,value] of authRateWindows) if(now-value.started>15*60*1000) authRateWindows.delete(ip);
  next();
}

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); }
  catch { res.status(503).json({ ok: false }); }
});

app.post('/api/auth/signup', limitAuthAttempts, async (req,res) => {
  const name=String(req.body?.name||'').trim().slice(0,100), email=String(req.body?.email||'').trim().toLowerCase(), password=String(req.body?.password||'');
  const phone=String(req.body?.phone||'').trim().slice(0,25), businessName=String(req.body?.businessName||'').trim().slice(0,120);
  const businessType=String(req.body?.businessType||'').trim().slice(0,40), address=String(req.body?.address||'').trim().slice(0,240), district=String(req.body?.district||'').trim().slice(0,80);
  if (!name || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[0-9+()\-\s]{8,25}$/.test(phone) || !businessName || !businessType || address.length < 5 || !district || password.length < 8 || Buffer.byteLength(password,'utf8') > 72) return res.status(400).json({ code:'invalid_signup', error:'সব তথ্য পূরণ করুন; সঠিক ফোন, দোকানের ঠিকানা এবং ৮–৭২ বাইটের পাসওয়ার্ড দিন।' });
  const passwordHash=await bcrypt.hash(password,12);
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [users]=await conn.execute('SELECT id FROM kb_users WHERE email=?',[email]);
    if(users.length) { await conn.rollback(); return res.status(409).json({ code:'email_exists', error:'এই ইমেইলে আগে থেকেই অ্যাকাউন্ট আছে।' }); }
    const [pending]=await conn.execute('SELECT id,status FROM kb_signup_requests WHERE email=? FOR UPDATE',[email]);
    if(pending[0]?.status==='pending') { await conn.rollback(); return res.status(202).json({ status:'pending', message:'আপনার সাইনআপ অনুরোধ অনুমোদনের অপেক্ষায় আছে।' }); }
    let requestId=pending[0]?.id;
    if(pending[0]) await conn.execute('UPDATE kb_signup_requests SET display_name=?,password_hash=?,status=\'pending\',requested_at=CURRENT_TIMESTAMP,reviewed_at=NULL,reviewed_by=NULL WHERE id=?',[name,passwordHash,requestId]);
    else {
      const [result]=await conn.execute('INSERT INTO kb_signup_requests(display_name,email,password_hash,status) VALUES(?,?,?,\'pending\')',[name,email,passwordHash]);
      requestId=result.insertId;
    }
    await conn.execute(`INSERT INTO kb_signup_details(request_id,phone,business_name,business_type,address,district) VALUES(?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE phone=VALUES(phone),business_name=VALUES(business_name),business_type=VALUES(business_type),address=VALUES(address),district=VALUES(district)`,
      [requestId,phone,businessName,businessType,address,district]);
    await conn.commit();
    res.status(202).json({ status:'pending', message:'অনুরোধ পাঠানো হয়েছে। সুপার অ্যাডমিন অনুমোদন দিলে আপনি সাইন ইন করতে পারবেন।' });
  } catch { await conn.rollback(); res.status(500).json({ error:'সাইনআপ অনুরোধ পাঠানো যায়নি। আবার চেষ্টা করুন।' }); }
  finally { conn.release(); }
});

app.post('/api/auth/login', limitAuthAttempts, async (req,res) => {
  const email=String(req.body?.email||'').trim().toLowerCase(), password=String(req.body?.password||'');
  try {
    const [rows]=await pool.execute(`SELECT u.id,u.email,u.display_name,u.password_hash,u.role,u.status,d.business_name
      FROM kb_users u LEFT JOIN kb_signup_requests r ON r.email=u.email AND r.status='approved'
      LEFT JOIN kb_signup_details d ON d.request_id=r.id WHERE u.email=?`,[email]);
    const user=rows[0];
    if(!user) {
      const [requests]=await pool.execute('SELECT status FROM kb_signup_requests WHERE email=?',[email]);
      if(requests[0]?.status==='pending') return res.status(403).json({ code:'signup_pending', error:'আপনার সাইনআপ অনুরোধ সুপার অ্যাডমিনের অনুমোদনের অপেক্ষায় আছে।' });
      if(requests[0]?.status==='rejected') return res.status(403).json({ code:'signup_rejected', error:'সাইনআপ অনুরোধ অনুমোদিত হয়নি। সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।' });
      return res.status(401).json({ error:'ইমেইল বা পাসওয়ার্ড সঠিক নয়।' });
    }
    if(user.status!=='active') return res.status(403).json({ code:'account_disabled', error:'অ্যাকাউন্টটি সক্রিয় নেই। সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।' });
    if(!await bcrypt.compare(password,user.password_hash)) return res.status(401).json({ error:'ইমেইল বা পাসওয়ার্ড সঠিক নয়।' });
    writeSession(req,res,user);
    res.json({ user:{uid:user.id,email:user.email,displayName:user.display_name,role:user.role,businessName:user.business_name || ''} });
  } catch { res.status(500).json({ error:'সাইন ইন করা যায়নি। আবার চেষ্টা করুন।' }); }
});

const normalizePhone = (value) => String(value || '').replace(/\D/g, '').replace(/^88/, '');
async function getSrMember(shopId, staffId) {
  const [rows]=await pool.execute('SELECT data_json FROM kb_documents WHERE shop_id=? AND collection_path=? AND doc_id=?',[shopId,`shops/${shopId}/staff`,staffId]);
  return rows[0] ? JSON.parse(rows[0].data_json) : null;
}
app.post('/api/auth/sr-pin', limitAuthAttempts, async (req,res) => {
  const businessPhone=normalizePhone(req.body?.businessPhone), staffPhone=normalizePhone(req.body?.staffPhone), pin=String(req.body?.pin||'');
  if(businessPhone.length<8 || staffPhone.length<8 || !/^\d{4,10}$/.test(pin)) return res.status(400).json({error:'দোকানের ফোন, SR-এর মোবাইল এবং ৪–১০ সংখ্যার PIN দিন।'});
  try {
    const [shops]=await pool.execute('SELECT id,owner_id,name,phone FROM kb_shops WHERE phone<>\'\'');
    const matches=shops.filter((shop)=>normalizePhone(shop.phone)===businessPhone);
    if(matches.length!==1) return res.status(401).json({error:'দোকানের ফোন নম্বর বা SR PIN সঠিক নয়।'});
    const shop=matches[0];
    const [owners]=await pool.execute('SELECT status FROM kb_users WHERE id=?',[shop.owner_id]);
    if(owners[0]?.status!=='active') return res.status(403).json({error:'এই প্রতিষ্ঠানের অ্যাকাউন্ট সক্রিয় নেই।'});
    const [rows]=await pool.execute('SELECT doc_id,data_json FROM kb_documents WHERE shop_id=? AND collection_path=?',[shop.id,`shops/${shop.id}/staff`]);
    const member=rows.map((row)=>({id:row.doc_id,...JSON.parse(row.data_json)})).find((item)=>item.role==='sr' && item.isActive && normalizePhone(item.phone)===staffPhone);
    if(!member) return res.status(401).json({error:'দোকানের ফোন নম্বর বা SR PIN সঠিক নয়।'});
    const valid=member.pinHash ? await bcrypt.compare(pin,member.pinHash) : member.pinCode===pin;
    if(!valid) return res.status(401).json({error:'দোকানের ফোন নম্বর বা SR PIN সঠিক নয়।'});
    writeSession(req,res,{id:shop.owner_id,sessionRole:'sr',shopId:shop.id,staffId:member.id,pinVersion:member.pinUpdatedAt||null});
    res.json({user:{uid:shop.owner_id,email:'',displayName:member.name,role:'sr',businessName:shop.name,shopId:shop.id,staffId:member.id,staffPhone:member.phone,routeArea:member.routeArea||'',branchName:member.branchName||''}});
  } catch { res.status(500).json({error:'SR PIN দিয়ে সাইন ইন করা যায়নি।'}); }
});

app.post('/api/auth/logout', (req,res) => { clearSession(req,res); res.json({ok:true}); });
app.get('/api/auth/me', async (req,res) => {
  try {
    const session=readSession(req);
    if(!session) return res.status(401).json({user:null});
    if(session.role==='sr') {
      const [owners]=await pool.execute('SELECT status FROM kb_users WHERE id=?',[session.uid]);
      const member=await getSrMember(session.shopId,session.staffId);
      if(owners[0]?.status!=='active' || !member || !member.isActive || member.role!=='sr' || (member.pinUpdatedAt||null)!==(session.pinVersion||null)) { clearSession(req,res); return res.status(401).json({user:null}); }
      const [shops]=await pool.execute('SELECT name FROM kb_shops WHERE id=? AND owner_id=?',[session.shopId,session.uid]);
      return res.json({user:{uid:session.uid,email:'',displayName:member.name,role:'sr',businessName:shops[0]?.name||'',shopId:session.shopId,staffId:session.staffId,staffPhone:member.phone,routeArea:member.routeArea||'',branchName:member.branchName||''}});
    }
    const [rows]=await pool.execute(`SELECT u.id,u.email,u.display_name,u.role,u.status,d.business_name FROM kb_users u
      LEFT JOIN kb_signup_requests r ON r.email=u.email AND r.status='approved'
      LEFT JOIN kb_signup_details d ON d.request_id=r.id WHERE u.id=?`,[session.uid]);
    const user=rows[0];
    if(!user || user.status!=='active') { clearSession(req,res); return res.status(401).json({user:null}); }
    res.json({user:{uid:user.id,email:user.email,displayName:user.display_name,role:user.role,businessName:user.business_name || ''}});
  } catch { res.status(503).json({error:'অ্যাকাউন্ট যাচাই করা যাচ্ছে না।'}); }
});

app.use('/api', async (req, res, next) => {
  try {
    const session=readSession(req);
    if (!session) return res.status(401).json({ error: 'সাইন ইন প্রয়োজন।' });
    const [rows]=await pool.execute('SELECT id,email,display_name,role,status FROM kb_users WHERE id=?',[session.uid]);
    const user=rows[0];
    if(!user || user.status!=='active') { clearSession(req,res); return res.status(401).json({error:'অ্যাকাউন্ট সক্রিয় নেই।'}); }
    if(session.role==='sr') {
      const member=await getSrMember(session.shopId,session.staffId);
      if(!member || !member.isActive || member.role!=='sr' || (member.pinUpdatedAt||null)!==(session.pinVersion||null)) { clearSession(req,res); return res.status(401).json({error:'SR account is inactive or PIN changed.'}); }
      req.user={uid:user.id,email:'',displayName:member.name,role:'sr',shopId:session.shopId,staffId:session.staffId,staffPhone:member.phone,routeArea:member.routeArea||'',branchName:member.branchName||''};
    } else req.user = {uid:user.id,email:user.email,displayName:user.display_name,role:user.role};
    next();
  } catch { res.status(401).json({ error: 'সেশন যাচাই করা যায়নি। আবার সাইন ইন করুন।' }); }
});

app.get('/api/admin/signup-requests', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'সুপার অ্যাডমিন অনুমতি প্রয়োজন।'});
  const [rows]=await pool.execute(`SELECT r.id,r.display_name,r.email,r.status,r.requested_at,d.phone,d.business_name,d.business_type,d.address,d.district
    FROM kb_signup_requests r LEFT JOIN kb_signup_details d ON d.request_id=r.id WHERE r.status='pending' ORDER BY r.requested_at ASC`);
  res.json(rows);
});
app.post('/api/admin/signup-requests/:id/:decision', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'সুপার অ্যাডমিন অনুমতি প্রয়োজন।'});
  const decision=req.params.decision;
  if(!['approve','reject'].includes(decision)) return res.status(400).json({error:'ভুল সিদ্ধান্ত।'});
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows]=await conn.execute('SELECT * FROM kb_signup_requests WHERE id=? FOR UPDATE',[req.params.id]);
    const request=rows[0];
    if(!request || request.status!=='pending') { await conn.rollback(); return res.status(409).json({error:'অনুরোধটি আর অপেক্ষমাণ নেই।'}); }
    if(decision==='approve') {
      await conn.execute('INSERT INTO kb_users(id,email,display_name,password_hash,role,status) VALUES(?,?,?,?,\'owner\',\'active\')',[crypto.randomUUID(),request.email,request.display_name,request.password_hash]);
    }
    await conn.execute('UPDATE kb_signup_requests SET status=?,password_hash=\'\',reviewed_at=CURRENT_TIMESTAMP,reviewed_by=? WHERE id=?',[decision==='approve'?'approved':'rejected',req.user.uid,request.id]);
    await conn.commit(); res.json({ok:true});
  } catch(e) { await conn.rollback(); res.status(500).json({error:'অনুরোধ আপডেট করা যায়নি।'}); }
  finally { conn.release(); }
});

function parsePath(value) {
  const parts = String(value || '').split('/').filter(Boolean);
  if (!parts.length || parts.some((p) => !/^[\w-]{1,128}$/.test(p))) throw new Error('Invalid path');
  return parts;
}
async function authorizeShop(uid, shopId, allowNew = false, payload = {}) {
  const [rows] = await pool.execute('SELECT owner_id FROM kb_shops WHERE id = ?', [shopId]);
  if (rows[0]) return rows[0].owner_id === uid;
  return allowNew && payload.ownerId === uid;
}
function shape(row) {
  if (!row) return null;
  return { id: row.doc_id, ...JSON.parse(row.data_json) };
}
function sqlDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 23).replace('T', ' ') : date.toISOString().slice(0, 23).replace('T', ' ');
}

app.get('/api/docs', async (req, res) => {
  try {
    const parts = parsePath(req.query.path);
    if (parts.length % 2 !== 1) return res.status(400).json({ error: 'Expected collection path' });
    if (parts[0] === 'shops' && parts.length === 1) {
      if(req.user.role==='sr') {
        const [rows]=await pool.execute('SELECT id, name, branch_name, address, phone, bin_number, default_vat_rate, receipt_footer, plan, currency, invoice_counter, owner_id, created_at, updated_at FROM kb_shops WHERE id=? AND owner_id=?',[req.user.shopId,req.user.uid]);
        return res.json(rows.map((r) => ({ id:r.id, ownerId:r.owner_id, name:r.name, branchName:r.branch_name, address:r.address, phone:r.phone, binNumber:'', defaultVatRate:0, receiptFooter:'', plan:'starter', currency:'BDT', invoiceCounter:0, createdAt:r.created_at, updatedAt:r.updated_at })));
      }
      const [rows] = await pool.execute('SELECT id, name, branch_name, address, phone, bin_number, default_vat_rate, receipt_footer, plan, currency, invoice_counter, owner_id, created_at, updated_at FROM kb_shops WHERE owner_id=?', [req.user.uid]);
      return res.json(rows.map((r) => ({ id:r.id, ownerId:r.owner_id, name:r.name, branchName:r.branch_name, address:r.address, phone:r.phone, binNumber:r.bin_number, defaultVatRate:Number(r.default_vat_rate), receiptFooter:r.receipt_footer, plan:r.plan, currency:r.currency, invoiceCounter:r.invoice_counter, createdAt:r.created_at, updatedAt:r.updated_at })));
    }
    if (parts[0] !== 'shops' || parts.length < 3 || !(await authorizeShop(req.user.uid, parts[1]))) return res.status(403).json({ error: 'Access denied' });
    if(req.user.role==='sr') {
      const allowed=['branches','products','customers','staff','srOrders','ledgerEntries'];
      if(parts[1]!==req.user.shopId) return res.status(403).json({error:'Access denied'});
      if(parts.length!==3 || !allowed.includes(parts[2])) return res.json([]);
    }
    const [rows] = await pool.execute('SELECT doc_id, data_json FROM kb_documents WHERE shop_id=? AND collection_path=?', [parts[1], parts.join('/')]);
    const where = JSON.parse(req.query.where || '[]');
    let docs=rows.map(shape).filter((doc) => where.every(([key, op, value]) => op === '==' && doc[key] === value));
    if(req.user.role==='sr') {
      if(parts[2]==='staff') docs=docs.filter((doc)=>doc.id===req.user.staffId).map(({pinCode,pinHash,...doc})=>doc);
      if(parts[2]==='branches') docs=docs.filter((doc)=>doc.name===req.user.branchName);
      if(parts[2]==='srOrders') docs=docs.filter((doc)=>doc.srId===req.user.staffId);
      if(parts[2]==='customers') docs=docs.filter((doc)=>doc.marketArea===req.user.routeArea || doc.createdByStaffId===req.user.staffId);
      if(parts[2]==='ledgerEntries') docs=docs.filter((doc)=>(doc.entryType==='sr_delivery'||doc.entryType==='customer_collection') && String(doc.notes||'').includes(`SR ${req.user.displayName}`));
      if(parts[2]==='products') docs=docs.map(({costPrice,...doc})=>doc);
    }
    if(parts[2]==='staff') docs=docs.map(({pinCode,pinHash,...doc})=>doc);
    return res.json(docs);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/batch', async (req, res) => {
  const ops = req.body?.ops;
  if (!Array.isArray(ops) || ops.length > 500) return res.status(400).json({ error: 'Invalid batch' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const op of ops) {
      const parts = parsePath(op.path); const isShop = parts.length === 2 && parts[0] === 'shops';
      const payload = op.data || {};
      if(req.user.role==='sr') {
        const coll=parts.slice(2,-1).join('/');
        if(parts[0]!=='shops' || parts[1]!==req.user.shopId || parts.length!==4 || !(['srOrders','customers'].includes(coll)) || op.type!=='set') throw new Error('SR accounts can only create customer records and new field orders.');
        if(coll==='srOrders') {
          if(payload.srId!==req.user.staffId || payload.status!=='pending') throw new Error('SR accounts can only submit their own pending orders.');
          const staff=await getSrMember(req.user.shopId,req.user.staffId);
          if(payload.customerId) {
            const [customerRows]=await conn.execute('SELECT data_json FROM kb_documents WHERE shop_id=? AND collection_path=? AND doc_id=?',[req.user.shopId,`shops/${req.user.shopId}/customers`,String(payload.customerId)]);
            const customerData=customerRows[0] ? JSON.parse(customerRows[0].data_json) : null;
            if(!customerData || (customerData.marketArea!==staff.routeArea && customerData.createdByStaffId!==req.user.staffId)) throw new Error('Retailer is outside your assigned route.');
            payload.customerName=customerData.name;
            payload.retailerShopName=customerData.shopName||customerData.name;
            payload.customerPhone=customerData.phone||'';
          }
          const requestedItems=Array.isArray(payload.items)?payload.items.slice(0,50):[];
          if(!requestedItems.length) throw new Error('An SR order must include products.');
          const productIds=[...new Set(requestedItems.map((item)=>String(item.productId||'')))];
          const [rowsWithIds]=await conn.query(`SELECT doc_id,data_json FROM kb_documents WHERE shop_id=? AND collection_path=? AND doc_id IN (${productIds.map(()=>'?').join(',')})`,[req.user.shopId,`shops/${req.user.shopId}/products`,...productIds]);
          const products=new Map(rowsWithIds.map((row)=>[row.doc_id,JSON.parse(row.data_json)]));
          const items=requestedItems.map((item)=>{
            const product=products.get(String(item.productId||'')),qty=Number(item.qty);
            if(!product || !product.isActive || !Number.isFinite(qty) || qty<=0 || qty>100000) throw new Error('Invalid product or order quantity.');
            const unitPrice=Number(product.sellingPrice)||0,lineTotal=Number((qty*unitPrice).toFixed(2));
            return {productId:String(item.productId),name:product.name,sku:product.sku,unit:product.unit,qty,unitPrice,lineTotal};
          });
          const subtotal=Number(items.reduce((sum,item)=>sum+item.lineTotal,0).toFixed(2));
          const discountAmount=Math.min(subtotal,Math.max(0,Number(payload.discountAmount)||0));
          const totalAmount=Number((subtotal-discountAmount).toFixed(2));
          const paidAmount=Math.min(totalAmount,Math.max(0,Number(payload.paidAmount)||0));
          const commissionRate=Number(staff.commissionRate)||0;
          Object.assign(payload,{srId:req.user.staffId,srName:req.user.displayName,routeArea:staff.routeArea||'',commissionRate,items,itemCount:items.reduce((sum,item)=>sum+item.qty,0),subtotal,discountAmount,totalAmount,paidAmount,dueAmount:Number((totalAmount-paidAmount).toFixed(2)),commissionAmount:Number((totalAmount*commissionRate/100).toFixed(2)),ownerId:req.user.uid});
        } else {
          if(payload.marketArea!==req.user.routeArea) throw new Error('Customer must be assigned to your market route.');
          payload.createdByStaffId=req.user.staffId; payload.ownerId=req.user.uid;
        }
        const [existing]=await conn.execute('SELECT doc_id FROM kb_documents WHERE shop_id=? AND collection_path=? AND doc_id=?',[req.user.shopId,parts.slice(0,-1).join('/'),parts.at(-1)]);
        if(existing.length) throw new Error('Cannot overwrite an existing record.');
      }
      if (parts[0] !== 'shops' || (isShop ? !(await authorizeShop(req.user.uid, parts[1], op.type === 'set', payload)) : parts.length < 4 || !(await authorizeShop(req.user.uid, parts[1])))) throw new Error('Access denied');
      const now = new Date().toISOString();
      if (op.type === 'delete') {
        if (isShop) { await conn.execute('DELETE FROM kb_documents WHERE shop_id=?', [parts[1]]); await conn.execute('DELETE FROM kb_shops WHERE id=? AND owner_id=?', [parts[1], req.user.uid]); }
        else await conn.execute('DELETE FROM kb_documents WHERE shop_id=? AND collection_path=? AND doc_id=?', [parts[1], parts.slice(0,-1).join('/'), parts.at(-1)]);
        continue;
      }
      if (!['set','update'].includes(op.type)) throw new Error('Invalid operation');
      if (isShop) {
        const [existingRows] = op.type === 'update'
          ? await conn.execute('SELECT * FROM kb_shops WHERE id=? AND owner_id=? FOR UPDATE', [parts[1],req.user.uid])
          : [[]];
        const existing = existingRows[0] ? {
          name:existingRows[0].name, branchName:existingRows[0].branch_name, address:existingRows[0].address,
          phone:existingRows[0].phone, binNumber:existingRows[0].bin_number, defaultVatRate:existingRows[0].default_vat_rate,
          receiptFooter:existingRows[0].receipt_footer, plan:existingRows[0].plan, currency:existingRows[0].currency,
          invoiceCounter:existingRows[0].invoice_counter, createdAt:existingRows[0].created_at,
        } : {};
        const d = { ...existing, ...payload, createdAt:payload.createdAt || existing.createdAt || now, updatedAt:now };
        await conn.execute(`INSERT INTO kb_shops(id,owner_id,name,branch_name,address,phone,bin_number,default_vat_rate,receipt_footer,plan,currency,invoice_counter,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),branch_name=VALUES(branch_name),address=VALUES(address),phone=VALUES(phone),bin_number=VALUES(bin_number),default_vat_rate=VALUES(default_vat_rate),receipt_footer=VALUES(receipt_footer),plan=VALUES(plan),currency=VALUES(currency),invoice_counter=VALUES(invoice_counter),updated_at=VALUES(updated_at)`,
        [parts[1],req.user.uid,d.name||'',d.branchName||'',d.address||'',d.phone||'',d.binNumber||'',Number(d.defaultVatRate||0),d.receiptFooter||'',d.plan||'growth',d.currency||'BDT',Number(d.invoiceCounter||0),sqlDate(d.createdAt),sqlDate(d.updatedAt)]);
      } else {
        const coll = parts.slice(0,-1).join('/'), id = parts.at(-1);
        const [old] = await conn.execute('SELECT data_json FROM kb_documents WHERE shop_id=? AND collection_path=? AND doc_id=? FOR UPDATE', [parts[1],coll,id]);
        const prior = old[0] ? JSON.parse(old[0].data_json) : {};
        const clean = { ...(op.type === 'update' ? prior : {}), ...payload, updatedAt:now };
        if(coll==='staff') {
          let pinChanged=false;
          if(payload.pinCode) { clean.pinHash=await bcrypt.hash(String(payload.pinCode).slice(0,10),12); pinChanged=true; }
          else if(prior.pinCode && !prior.pinHash) { clean.pinHash=await bcrypt.hash(String(prior.pinCode).slice(0,10),12); pinChanged=true; }
          if(pinChanged) clean.pinUpdatedAt=now;
          delete clean.pinCode;
        }
        if(coll==='staff' && clean.role==='sr' && !clean.pinHash) throw new Error('A PIN is required for every SR account.');
        if (!old[0]) clean.createdAt = clean.createdAt || now;
        if ((clean.ownerId && clean.ownerId !== req.user.uid) || !await authorizeShop(req.user.uid, parts[1])) throw new Error('Access denied');
        await conn.execute('INSERT INTO kb_documents(shop_id,collection_path,doc_id,owner_id,data_json) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE owner_id=VALUES(owner_id),data_json=VALUES(data_json)', [parts[1],coll,id,req.user.uid,JSON.stringify(clean)]);
      }
    }
    await conn.commit(); res.json({ ok:true });
  } catch (e) { await conn.rollback(); res.status(400).json({ error:e.message }); }
  finally { conn.release(); }
});

app.use(express.static(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')));
app.get('*', (_req,res) => res.sendFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/index.html')));
const port = Number(process.env.PORT || 3000);
ensureSuperAdmin()
  .then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`KB Shop listening on ${port}`));
  })
  .catch((error) => {
    console.error('Server startup failed while connecting to MySQL or provisioning the super admin:', error);
    process.exit(1);
  });
