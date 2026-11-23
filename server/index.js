import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
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
  const token = signSession({ uid:user.id, role:user.sessionRole || user.role, shopId:user.shopId, staffId:user.staffId, pinVersion:user.pinVersion || null, phoneVersion:user.phoneVersion || null, exp:Math.floor(Date.now()/1000)+sessionMaxAge });
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
async function ensureAdminTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS kb_admin_customers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    company_name VARCHAR(160) NOT NULL,
    contact_name VARCHAR(120) NOT NULL DEFAULT '',
    phone VARCHAR(30) NOT NULL DEFAULT '',
    email VARCHAR(254) NOT NULL DEFAULT '',
    address VARCHAR(300) NOT NULL DEFAULT '',
    district VARCHAR(100) NOT NULL DEFAULT '',
    customer_type VARCHAR(30) NOT NULL DEFAULT 'lead',
    source VARCHAR(100) NOT NULL DEFAULT '',
    notes TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    INDEX kb_admin_customers_type (customer_type),
    INDEX kb_admin_customers_phone (phone),
    INDEX kb_admin_customers_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kb_admin_documents (
    id CHAR(36) NOT NULL PRIMARY KEY,
    document_no VARCHAR(48) NOT NULL UNIQUE,
    document_type VARCHAR(24) NOT NULL,
    customer_id CHAR(36) NULL,
    customer_snapshot JSON NOT NULL,
    shop_id VARCHAR(128) NULL,
    related_document_id CHAR(36) NULL,
    issue_date DATE NOT NULL,
    due_date DATE NULL,
    status VARCHAR(24) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'BDT',
    subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    lines_json JSON NOT NULL,
    notes TEXT NOT NULL,
    created_by CHAR(36) NOT NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    INDEX kb_admin_docs_type_date (document_type, issue_date),
    INDEX kb_admin_docs_shop (shop_id, document_type, issue_date),
    INDEX kb_admin_docs_customer (customer_id, issue_date),
    INDEX kb_admin_docs_related (related_document_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
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
    if(user.role==='super_admin') return res.status(403).json({error:'সুপার অ্যাডমিন লগইনের জন্য /admin ব্যবহার করুন।'});
    if(user.status!=='active') return res.status(403).json({ code:'account_disabled', error:'অ্যাকাউন্টটি সক্রিয় নেই। সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।' });
    if(!await bcrypt.compare(password,user.password_hash)) return res.status(401).json({ error:'ইমেইল বা পাসওয়ার্ড সঠিক নয়।' });
    writeSession(req,res,user);
    res.json({ user:{uid:user.id,email:user.email,displayName:user.display_name,role:user.role,businessName:user.business_name || ''} });
  } catch { res.status(500).json({ error:'সাইন ইন করা যায়নি। আবার চেষ্টা করুন।' }); }
});

app.post('/api/auth/admin-login', limitAuthAttempts, async (req,res) => {
  const email=String(req.body?.email||'').trim().toLowerCase(), password=String(req.body?.password||'');
  try {
    const [rows]=await pool.execute('SELECT id,email,display_name,password_hash,role,status FROM kb_users WHERE email=?',[email]);
    const user=rows[0];
    if(!user || user.role!=='super_admin' || user.status!=='active' || !await bcrypt.compare(password,user.password_hash)) {
      return res.status(401).json({error:'Admin email or password is incorrect.'});
    }
    writeSession(req,res,user);
    res.json({user:{uid:user.id,email:user.email,displayName:user.display_name,role:user.role}});
  } catch { res.status(500).json({error:'Could not sign in. Please try again.'}); }
});

const normalizePhone = (value) => String(value || '').replace(/\D/g, '').replace(/^88/, '');
async function getSrMember(shopId, staffId) {
  const [rows]=await pool.execute('SELECT data_json FROM kb_documents WHERE shop_id=? AND collection_path=? AND doc_id=?',[shopId,`shops/${shopId}/staff`,staffId]);
  return rows[0] ? JSON.parse(rows[0].data_json) : null;
}
app.post('/api/auth/sr-phone', limitAuthAttempts, async (req,res) => {
  const staffPhone=normalizePhone(req.body?.phone);
  if(staffPhone.length<8 || staffPhone.length>15) return res.status(400).json({error:'সঠিক SR মোবাইল নম্বর দিন।'});
  try {
    const [rows]=await pool.execute(`SELECT d.shop_id,d.doc_id,d.data_json,s.owner_id,s.name AS shop_name
      FROM kb_documents d
      JOIN kb_shops s ON s.id=d.shop_id
      JOIN kb_users u ON u.id=s.owner_id AND u.status='active'
      WHERE d.collection_path=CONCAT('shops/',d.shop_id,'/staff')`);
    const matches=rows.map((row)=>({shopId:row.shop_id,ownerId:row.owner_id,shopName:row.shop_name,id:row.doc_id,...JSON.parse(row.data_json)}))
      .filter((member)=>member.role==='sr' && member.isActive && normalizePhone(member.phone)===staffPhone);
    // Phone numbers are identifiers, so require exactly one active SR match
    // across all shops instead of selecting an arbitrary tenant on collisions.
    if(matches.length!==1) return res.status(401).json({error:'এই মোবাইল নম্বরে একটিমাত্র সক্রিয় SR অ্যাকাউন্ট পাওয়া যায়নি। মালিকের সাথে যোগাযোগ করুন।'});
    const member=matches[0];
    writeSession(req,res,{id:member.ownerId,sessionRole:'sr',shopId:member.shopId,staffId:member.id,phoneVersion:member.phone||''});
    res.json({user:{uid:member.ownerId,email:'',displayName:member.name,role:'sr',businessName:member.shopName,shopId:member.shopId,staffId:member.id,staffPhone:member.phone,routeArea:member.routeArea||'',branchName:member.branchName||''}});
  } catch { res.status(500).json({error:'SR মোবাইল নম্বর দিয়ে সাইন ইন করা যায়নি।'}); }
});

app.post('/api/auth/logout', (req,res) => { clearSession(req,res); res.json({ok:true}); });
app.get('/api/auth/me', async (req,res) => {
  try {
    const session=readSession(req);
    if(!session) return res.status(401).json({user:null});
    if(session.role==='sr') {
      const [owners]=await pool.execute('SELECT status FROM kb_users WHERE id=?',[session.uid]);
      const member=await getSrMember(session.shopId,session.staffId);
      if(owners[0]?.status!=='active' || !member || !member.isActive || member.role!=='sr' || (member.phone||'')!==(session.phoneVersion||'')) { clearSession(req,res); return res.status(401).json({user:null}); }
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
      if(!member || !member.isActive || member.role!=='sr' || (member.phone||'')!==(session.phoneVersion||'')) { clearSession(req,res); return res.status(401).json({error:'SR account is inactive or phone changed.'}); }
      req.user={uid:user.id,email:'',displayName:member.name,role:'sr',shopId:session.shopId,staffId:session.staffId,staffPhone:member.phone,routeArea:member.routeArea||'',branchName:member.branchName||''};
    } else req.user = {uid:user.id,email:user.email,displayName:user.display_name,role:user.role};
    next();
  } catch { res.status(401).json({ error: 'সেশন যাচাই করা যায়নি। আবার সাইন ইন করুন।' }); }
});

app.get('/api/admin/signup-requests', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'Super Admin access is required.'});
  const [rows]=await pool.execute(`SELECT r.id,r.display_name,r.email,r.status,r.requested_at,d.phone,d.business_name,d.business_type,d.address,d.district
    FROM kb_signup_requests r LEFT JOIN kb_signup_details d ON d.request_id=r.id WHERE r.status='pending' ORDER BY r.requested_at ASC`);
  res.json(rows);
});
app.post('/api/admin/signup-requests/:id/:decision', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'Super Admin access is required.'});
  const decision=req.params.decision;
  if(!['approve','reject'].includes(decision)) return res.status(400).json({error:'Invalid signup decision.'});
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows]=await conn.execute('SELECT * FROM kb_signup_requests WHERE id=? FOR UPDATE',[req.params.id]);
    const request=rows[0];
    if(!request || request.status!=='pending') { await conn.rollback(); return res.status(409).json({error:'This request is no longer pending.'}); }
    if(decision==='approve') {
      await conn.execute('INSERT INTO kb_users(id,email,display_name,password_hash,role,status) VALUES(?,?,?,?,\'owner\',\'active\')',[crypto.randomUUID(),request.email,request.display_name,request.password_hash]);
    }
    await conn.execute('UPDATE kb_signup_requests SET status=?,password_hash=\'\',reviewed_at=CURRENT_TIMESTAMP,reviewed_by=? WHERE id=?',[decision==='approve'?'approved':'rejected',req.user.uid,request.id]);
    await conn.commit(); res.json({ok:true});
  } catch(e) { await conn.rollback(); res.status(500).json({error:'Could not update the signup request.'}); }
  finally { conn.release(); }
});

app.get('/api/admin/overview', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'Super Admin access is required.'});
  try {
    const [rows]=await pool.query(`SELECT
      (SELECT COUNT(*) FROM kb_users WHERE role='owner') AS total_owners,
      (SELECT COUNT(*) FROM kb_users WHERE role='owner' AND status='active') AS active_owners,
      (SELECT COUNT(*) FROM kb_users WHERE role='owner' AND status='disabled') AS disabled_owners,
      (SELECT COUNT(*) FROM kb_shops) AS total_shops,
      (SELECT COUNT(*) FROM kb_signup_requests WHERE status='pending') AS pending_signups,
      (SELECT COUNT(*) FROM kb_documents WHERE collection_path LIKE '%/products') AS total_products,
      (SELECT COUNT(*) FROM kb_documents WHERE collection_path LIKE '%/sales') AS total_sales,
      (SELECT COUNT(*) FROM kb_documents WHERE collection_path LIKE '%/customers') AS total_customers,
      (SELECT COUNT(*) FROM kb_documents WHERE collection_path LIKE '%/branches') AS total_branches,
      (SELECT COUNT(*) FROM kb_admin_customers) AS crm_customers,
      (SELECT COUNT(*) FROM kb_admin_documents WHERE document_type='invoice') AS admin_invoices,
      (SELECT COALESCE(SUM(paid_amount),0) FROM kb_admin_documents WHERE document_type='invoice') AS admin_collected,
      (SELECT COALESCE(SUM(total_amount-paid_amount),0) FROM kb_admin_documents WHERE document_type='invoice') AS admin_outstanding`);
    const row=rows[0]||{};
    res.json(Object.fromEntries(Object.entries(row).map(([key,value])=>[key,Number(value||0)])));
  } catch { res.status(500).json({error:'Could not load the system overview.'}); }
});

app.get('/api/admin/shops', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'Super Admin access is required.'});
  try {
    const [rows]=await pool.query(`SELECT s.id,s.owner_id,s.name,s.branch_name,s.phone,s.plan,s.updated_at,
      u.display_name AS owner_name,u.email AS owner_email,u.status AS owner_status,
      (SELECT COUNT(*) FROM kb_documents d WHERE d.shop_id=s.id AND d.collection_path=CONCAT('shops/',s.id,'/products')) AS products,
      (SELECT COUNT(*) FROM kb_documents d WHERE d.shop_id=s.id AND d.collection_path=CONCAT('shops/',s.id,'/sales')) AS sales,
      (SELECT COUNT(*) FROM kb_documents d WHERE d.shop_id=s.id AND d.collection_path=CONCAT('shops/',s.id,'/customers')) AS customers,
      (SELECT COUNT(*) FROM kb_documents d WHERE d.shop_id=s.id AND d.collection_path=CONCAT('shops/',s.id,'/branches')) AS branches
      FROM kb_shops s JOIN kb_users u ON u.id=s.owner_id ORDER BY s.updated_at DESC LIMIT 1000`);
    res.json(rows);
  } catch { res.status(500).json({error:'Could not load the business list.'}); }
});

app.get('/api/admin/users', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'Super Admin access is required.'});
  try {
    const [rows]=await pool.query(`SELECT u.id,u.display_name,u.email,u.status,u.created_at,COUNT(s.id) AS shops
      FROM kb_users u LEFT JOIN kb_shops s ON s.owner_id=u.id WHERE u.role='owner'
      GROUP BY u.id,u.display_name,u.email,u.status,u.created_at ORDER BY u.created_at DESC LIMIT 1000`);
    res.json(rows);
  } catch { res.status(500).json({error:'Could not load owner accounts.'}); }
});

app.patch('/api/admin/users/:id/status', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'Super Admin access is required.'});
  const status=String(req.body?.status||'');
  if(!['active','disabled'].includes(status)) return res.status(400).json({error:'Invalid account status.'});
  try {
    const [result]=await pool.execute("UPDATE kb_users SET status=? WHERE id=? AND role='owner'",[status,req.params.id]);
    if(!result.affectedRows) return res.status(404).json({error:'Owner account not found.'});
    res.json({ok:true,status});
  } catch { res.status(500).json({error:'Could not update the account status.'}); }
});

app.patch('/api/admin/shops/:id/plan', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'Super Admin access is required.'});
  const plan=String(req.body?.plan||'');
  if(!['starter','growth','enterprise'].includes(plan)) return res.status(400).json({error:'Invalid subscription plan.'});
  try {
    const [result]=await pool.execute('UPDATE kb_shops SET plan=?,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?',[plan,req.params.id]);
    if(!result.affectedRows) return res.status(404).json({error:'Business not found.'});
    res.json({ok:true,plan});
  } catch { res.status(500).json({error:'Could not update the subscription plan.'}); }
});

const adminCustomerFields = (body = {}) => ({
  company_name: String(body.company_name || '').trim().slice(0,160),
  contact_name: String(body.contact_name || '').trim().slice(0,120),
  phone: String(body.phone || '').trim().slice(0,30),
  email: String(body.email || '').trim().toLowerCase().slice(0,254),
  address: String(body.address || '').trim().slice(0,300),
  district: String(body.district || '').trim().slice(0,100),
  customer_type: ['lead','prospect','customer','inactive'].includes(body.customer_type) ? body.customer_type : 'lead',
  source: String(body.source || '').trim().slice(0,100),
  notes: String(body.notes || '').trim().slice(0,5000),
});
const roundMoney = (value) => Math.round((Number(value)+Number.EPSILON)*100)/100;

app.get('/api/admin/crm/customers', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'Super Admin access is required.'});
  try {
    const [rows]=await pool.query('SELECT * FROM kb_admin_customers ORDER BY updated_at DESC LIMIT 2000');
    res.json(rows);
  } catch { res.status(500).json({error:'Could not load CRM contacts.'}); }
});

app.post('/api/admin/crm/customers', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'Super Admin access is required.'});
  const customer=adminCustomerFields(req.body);
  if(!customer.company_name && !customer.contact_name) return res.status(400).json({error:'Company or contact name is required.'});
  try {
    const id=crypto.randomUUID(), now=new Date();
    await pool.execute(`INSERT INTO kb_admin_customers(id,company_name,contact_name,phone,email,address,district,customer_type,source,notes,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,[id,customer.company_name,customer.contact_name,customer.phone,customer.email,customer.address,customer.district,customer.customer_type,customer.source,customer.notes,now,now]);
    res.status(201).json({id,...customer,created_at:now,updated_at:now});
  } catch { res.status(500).json({error:'Could not create the CRM contact.'}); }
});

app.put('/api/admin/crm/customers/:id', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'Super Admin access is required.'});
  const customer=adminCustomerFields(req.body);
  if(!customer.company_name && !customer.contact_name) return res.status(400).json({error:'Company or contact name is required.'});
  try {
    const [result]=await pool.execute(`UPDATE kb_admin_customers SET company_name=?,contact_name=?,phone=?,email=?,address=?,district=?,customer_type=?,source=?,notes=?,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?`,
      [customer.company_name,customer.contact_name,customer.phone,customer.email,customer.address,customer.district,customer.customer_type,customer.source,customer.notes,req.params.id]);
    if(!result.affectedRows) return res.status(404).json({error:'CRM contact not found.'});
    res.json({ok:true});
  } catch { res.status(500).json({error:'Could not update the CRM contact.'}); }
});

app.get('/api/admin/documents', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'Super Admin access is required.'});
  try {
    const [rows]=await pool.query(`SELECT d.*,s.name AS shop_name FROM kb_admin_documents d
      LEFT JOIN kb_shops s ON s.id=d.shop_id ORDER BY d.issue_date DESC,d.created_at DESC LIMIT 2000`);
    res.json(rows);
  } catch { res.status(500).json({error:'Could not load commercial documents.'}); }
});

app.post('/api/admin/documents', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'Super Admin access is required.'});
  const type=String(req.body?.document_type||'');
  const prefix={invoice:'INV',quotation:'QUO',money_receipt:'RCT'}[type];
  const issueDate=String(req.body?.issue_date||'').slice(0,10);
  const dueDate=String(req.body?.due_date||'').slice(0,10);
  const customerId=String(req.body?.customer_id||'').trim()||null;
  let shopId=String(req.body?.shop_id||'').trim()||null;
  const relatedDocumentId=String(req.body?.related_document_id||'').trim()||null;
  const statusValue=String(req.body?.status||'');
  const allowedStatuses={invoice:['draft','sent','partial','paid','void'],quotation:['draft','sent','accepted','rejected','expired'],money_receipt:['paid']};
  const datePattern=/^\d{4}-\d{2}-\d{2}$/;
  const rawLines=Array.isArray(req.body?.lines)?req.body.lines:[];
  if(!prefix || !datePattern.test(issueDate) || (dueDate&&!datePattern.test(dueDate)) || !rawLines.length || rawLines.length>100 || !(allowedStatuses[type]||[]).includes(statusValue)) {
    return res.status(400).json({error:'Check the document type, dates, status, and line items.'});
  }
  const lines=[];
  for(const raw of rawLines) {
    const description=String(raw?.description||'').trim().slice(0,240);
    const quantity=Number(raw?.quantity), unitPrice=Number(raw?.unit_price);
    if(!description || !Number.isFinite(quantity) || quantity<=0 || quantity>1000000 || !Number.isFinite(unitPrice) || unitPrice<0 || unitPrice>1000000000) return res.status(400).json({error:'Each line needs a description, positive quantity, and valid unit price.'});
    lines.push({description,quantity,unit_price:Math.round(unitPrice*100)/100,line_total:Math.round(quantity*unitPrice*100)/100});
  }
  const money=(value)=>Math.round((Number(value)+Number.EPSILON)*100)/100;
  const subtotal=money(lines.reduce((sum,line)=>sum+line.line_total,0));
  const discount=money(Math.min(subtotal,Math.max(0,Number(req.body?.discount_amount)||0)));
  const taxRate=Math.min(100,Math.max(0,Number(req.body?.tax_rate)||0));
  const taxAmount=money((subtotal-discount)*taxRate/100);
  const total=money(subtotal-discount+taxAmount);
  if(type==='money_receipt' && total<=0) return res.status(400).json({error:'A money receipt amount must be greater than zero.'});
  const notes=String(req.body?.notes||'').trim().slice(0,5000);
  const currency=String(req.body?.currency||'BDT').toUpperCase().slice(0,3);
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();
    let customerSnapshot={company_name:'',contact_name:'',phone:'',email:'',address:'',district:''};
    if(customerId) {
      const [customers]=await conn.execute('SELECT company_name,contact_name,phone,email,address,district FROM kb_admin_customers WHERE id=?',[customerId]);
      if(!customers[0]) { await conn.rollback(); return res.status(404).json({error:'CRM contact not found.'}); }
      customerSnapshot=customers[0];
    } else if(req.body?.customer_snapshot && typeof req.body.customer_snapshot==='object') {
      customerSnapshot={
        company_name:String(req.body.customer_snapshot.company_name||'').trim().slice(0,160),
        contact_name:String(req.body.customer_snapshot.contact_name||'').trim().slice(0,120),
        phone:String(req.body.customer_snapshot.phone||'').trim().slice(0,30),
        email:String(req.body.customer_snapshot.email||'').trim().toLowerCase().slice(0,254),
        address:String(req.body.customer_snapshot.address||'').trim().slice(0,300),
        district:String(req.body.customer_snapshot.district||'').trim().slice(0,100),
      };
    }
    if(type!=='money_receipt' && !customerSnapshot.company_name && !customerSnapshot.contact_name) { await conn.rollback(); return res.status(400).json({error:'Select a CRM customer or enter a customer name.'}); }
    if(shopId) {
      const [businesses]=await conn.execute('SELECT id FROM kb_shops WHERE id=?',[shopId]);
      if(!businesses[0]) { await conn.rollback(); return res.status(404).json({error:'POS business not found.'}); }
    }
    let relatedInvoice=null;
    if(relatedDocumentId) {
      const [documents]=await conn.execute("SELECT * FROM kb_admin_documents WHERE id=? AND document_type='invoice' FOR UPDATE",[relatedDocumentId]);
      relatedInvoice=documents[0]||null;
      if(!relatedInvoice) { await conn.rollback(); return res.status(404).json({error:'Related invoice not found.'}); }
      if(type!=='money_receipt') { await conn.rollback(); return res.status(400).json({error:'Only a money receipt can be linked to an invoice.'}); }
      if(shopId && relatedInvoice.shop_id && shopId!==relatedInvoice.shop_id) { await conn.rollback(); return res.status(400).json({error:'The receipt and invoice must belong to the same business.'}); }
      if(customerId && relatedInvoice.customer_id && customerId!==relatedInvoice.customer_id) { await conn.rollback(); return res.status(400).json({error:'The receipt and invoice must belong to the same CRM customer.'}); }
      shopId=shopId||relatedInvoice.shop_id;
      customerSnapshot=typeof relatedInvoice.customer_snapshot==='string'?JSON.parse(relatedInvoice.customer_snapshot):relatedInvoice.customer_snapshot;
    }
    const paidAmount=type==='money_receipt'?total:(statusValue==='paid'?total:money(Math.min(total,Math.max(0,Number(req.body?.paid_amount)||0))));
    const actualStatus=type==='invoice'?(paidAmount>=total&&total>0?'paid':paidAmount>0?'partial':statusValue==='void'?'void':statusValue==='draft'?'draft':'sent'):statusValue;
    const id=crypto.randomUUID();
    const documentNo=`AZS-${prefix}-${issueDate.replaceAll('-','')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const now=new Date();
    await conn.execute(`INSERT INTO kb_admin_documents(id,document_no,document_type,customer_id,customer_snapshot,shop_id,related_document_id,issue_date,due_date,status,currency,subtotal,discount_amount,tax_amount,total_amount,paid_amount,lines_json,notes,created_by,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
      id,documentNo,type,customerId,JSON.stringify(customerSnapshot),shopId,relatedDocumentId,issueDate,dueDate||null,actualStatus,currency,subtotal,discount,taxAmount,total,paidAmount,JSON.stringify(lines),notes,req.user.uid,now,now,
    ]);
    if(relatedInvoice) {
      const nextPaid=money(Number(relatedInvoice.paid_amount)+total);
      if(nextPaid>Number(relatedInvoice.total_amount)+0.01) { await conn.rollback(); return res.status(400).json({error:'Receipt amount exceeds the invoice balance.'}); }
      await conn.execute('UPDATE kb_admin_documents SET paid_amount=?,status=?,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?',[nextPaid,nextPaid>=Number(relatedInvoice.total_amount)?'paid':'partial',relatedInvoice.id]);
    }
    await conn.commit();
    res.status(201).json({id,document_no:documentNo,document_type:type,customer_id:customerId,customer_snapshot:customerSnapshot,shop_id:shopId,related_document_id:relatedDocumentId,issue_date:issueDate,due_date:dueDate||null,status:actualStatus,currency,subtotal,discount_amount:discount,tax_amount:taxAmount,total_amount:total,paid_amount:paidAmount,lines,notes,created_at:now});
  } catch(error) {
    await conn.rollback();
    res.status(500).json({error:'Could not save the document.'});
  } finally { conn.release(); }
});

app.get('/api/admin/software-sales', async (req,res) => {
  if(req.user.role!=='super_admin') return res.status(403).json({error:'Super Admin access is required.'});
  try {
    const [rows]=await pool.query(`SELECT d.id,d.document_no,d.issue_date,d.status,d.currency,d.total_amount,d.paid_amount,
      d.shop_id,s.name AS shop_name,d.customer_snapshot,d.created_at
      FROM kb_admin_documents d LEFT JOIN kb_shops s ON s.id=d.shop_id
      WHERE d.document_type='invoice' AND d.shop_id IS NOT NULL AND d.status<>'void'
      ORDER BY d.issue_date DESC,d.created_at DESC LIMIT 5000`);
    const invoices=rows.map((row)=>({...row,customer_snapshot:typeof row.customer_snapshot==='string'?JSON.parse(row.customer_snapshot):row.customer_snapshot,total_amount:Number(row.total_amount),paid_amount:Number(row.paid_amount)}));
    const summary=invoices.reduce((total,invoice)=>({count:total.count+1,invoiced:roundMoney(total.invoiced+invoice.total_amount),collected:roundMoney(total.collected+invoice.paid_amount),outstanding:roundMoney(total.outstanding+invoice.total_amount-invoice.paid_amount)}),{count:0,invoiced:0,collected:0,outstanding:0});
    res.json({summary,invoices});
  } catch { res.status(500).json({error:'Could not load software sales.'}); }
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
        if (!old[0]) clean.createdAt = clean.createdAt || now;
        if ((clean.ownerId && clean.ownerId !== req.user.uid) || !await authorizeShop(req.user.uid, parts[1])) throw new Error('Access denied');
        await conn.execute('INSERT INTO kb_documents(shop_id,collection_path,doc_id,owner_id,data_json) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE owner_id=VALUES(owner_id),data_json=VALUES(data_json)', [parts[1],coll,id,req.user.uid,JSON.stringify(clean)]);
      }
    }
    await conn.commit(); res.json({ ok:true });
  } catch (e) { await conn.rollback(); res.status(400).json({ error:e.message }); }
  finally { conn.release(); }
});

const serverDir = path.dirname(fileURLToPath(import.meta.url));
function findFrontendBuild() {
  const candidates = [
    path.resolve(serverDir, '../dist'),
    path.resolve(process.cwd(), 'dist'),
  ];
  // Hostinger may publish the configured output directory to public_html,
  // separately from the Node.js release folder. Search nearby ancestors so
  // the Express app can serve either deployment layout.
  for (const start of [serverDir, process.cwd()]) {
    let dir = path.resolve(start);
    for (let depth = 0; depth < 6; depth += 1) {
      candidates.push(path.join(dir, 'public_html'));
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));
}

const frontendDir = findFrontendBuild();
if (frontendDir) {
  app.use(express.static(frontendDir));
  console.log(`Frontend build found in ${frontendDir}`);
} else {
  console.error('Frontend build missing: run `npm run build` and deploy the generated dist/index.html.');
}
app.get('*', (_req, res) => {
  if (!frontendDir) {
    return res.status(503).type('text/plain').send('Frontend build is missing. Set the Hostinger build command to `npm run build` and deploy the `dist` output.');
  }
  return res.sendFile(path.join(frontendDir, 'index.html'));
});
const port = Number(process.env.PORT || 3000);
ensureAdminTables()
  .then(() => ensureSuperAdmin())
  .then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`KB Shop listening on ${port}`));
  })
  .catch((error) => {
    console.error('Server startup failed while connecting to MySQL or provisioning the super admin:', error);
    process.exit(1);
  });
