const storageKey = 'kbshop.local-demo-data.v1';
const localOwnerId = 'local-demo-owner';
const localShopId = 'local-demo-shop';
const localBranchId = 'local-demo-branch';

type LocalData = {
  shops: Record<string, Record<string, any>>;
  collections: Record<string, Record<string, any>>;
};
let memoryData:LocalData|undefined;

function createSeed(): LocalData {
  const now = new Date();
  const iso = now.toISOString();
  const today = iso.slice(0, 10);
  const shop = {
    id:localShopId, ownerId:localOwnerId, name:'Demo Super Shop',
    branchName:'Main Demo Branch', address:'Mainimukh Bazar, Rangamati', phone:'01700000000',
    binNumber:'', defaultVatRate:5, receiptFooter:'KB Shop local demo workspace',
    plan:'growth', currency:'BDT', invoiceCounter:24, createdAt:iso, updatedAt:iso,
  };
  const products = [
    {id:'demo-rice',name:'Miniket Rice 5kg',barcode:'8941000000011',sku:'RICE-5KG',category:'Rice & Grains',unit:'bag',costPrice:420,sellingPrice:490,vatRate:5,stock:34,reorderLevel:5},
    {id:'demo-oil',name:'Soybean Oil 2L',barcode:'8941000000012',sku:'OIL-2L',category:'Cooking Oil',unit:'bottle',costPrice:315,sellingPrice:355,vatRate:5,stock:26,reorderLevel:5},
    {id:'demo-tea',name:'Premium Tea 400g',barcode:'8941000000013',sku:'TEA-400',category:'Beverages',unit:'pack',costPrice:185,sellingPrice:220,vatRate:5,stock:18,reorderLevel:4},
    {id:'demo-sugar',name:'Refined Sugar 1kg',barcode:'8941000000014',sku:'SUGAR-1',category:'Rice & Grains',unit:'kg',costPrice:112,sellingPrice:130,vatRate:5,stock:42,reorderLevel:8},
    {id:'demo-milk',name:'UHT Milk 1L',barcode:'8941000000015',sku:'MILK-1L',category:'Dairy',unit:'pack',costPrice:82,sellingPrice:95,vatRate:5,stock:20,reorderLevel:5},
    {id:'demo-soap',name:'Laundry Soap 125g',barcode:'8941000000016',sku:'SOAP-125',category:'Home Care',unit:'pcs',costPrice:38,sellingPrice:48,vatRate:5,stock:50,reorderLevel:10},
  ].map((item) => ({...item,shopId:localShopId,ownerId:localOwnerId,isActive:true,createdAt:iso,updatedAt:iso}));
  const saleItems = [
    {productId:'demo-rice',name:'Miniket Rice 5kg',barcode:'8941000000011',unit:'bag',qty:2,unitPrice:490,costPrice:420,vatRate:5,lineTotal:980},
    {productId:'demo-oil',name:'Soybean Oil 2L',barcode:'8941000000012',unit:'bottle',qty:1,unitPrice:355,costPrice:315,vatRate:5,lineTotal:355},
  ];
  const subtotal=1335, vatAmount=67, totalAmount=1402;
  const collections: LocalData['collections'] = {};
  const add = (collection:string,id:string,data:Record<string,any>) => {
    const path=`shops/${localShopId}/${collection}`;
    collections[path] ||= {};
    collections[path][id]={id,...data};
  };
  add('branches',localBranchId,{shopId:localShopId,ownerId:localOwnerId,name:'Main Demo Branch',code:'RNG-01',address:'Mainimukh Bazar, Rangamati',phone:'01700000000',managerName:'Demo Owner',isActive:true,createdAt:iso,updatedAt:iso});
  for(const product of products) add('products',product.id,product);
  add('customers','demo-customer-1',{shopId:localShopId,ownerId:localOwnerId,name:'Rahim Store',shopName:'Rahim Store',marketArea:'Main Market',customerType:'wholesale',phone:'01812345678',address:'Mainimukh Bazar',loyaltyPoints:14,totalSpent:6800,visitCount:8,balanceDue:850,creditLimit:5000,createdAt:iso,updatedAt:iso});
  add('suppliers','demo-supplier-1',{shopId:localShopId,ownerId:localOwnerId,name:'Rangamati Wholesale',company:'Rangamati Wholesale',phone:'01912345678',address:'Rangamati',category:'Grocery',totalPurchased:34000,balanceDue:2200,createdAt:iso,updatedAt:iso});
  add('sales','demo-sale-1',{shopId:localShopId,ownerId:localOwnerId,invoiceNumber:'BG-2026-00024',cashierName:'Demo Cashier',branchName:'Main Demo Branch',customerId:'',customerName:'Walk-in Customer',customerPhone:'',items:saleItems,itemCount:3,subtotal,discountAmount:0,vatAmount,totalAmount,paidAmount:1500,changeAmount:98,dueAmount:0,paymentMethod:'cash',paymentRef:'',status:'completed',createdAt:iso,updatedAt:iso});
  add('expenses','demo-expense-1',{shopId:localShopId,ownerId:localOwnerId,title:'Shop utilities',category:'Utilities',amount:1200,paymentMethod:'cash',branchName:'Main Demo Branch',reference:'',notes:'Demo expense',expenseDate:today,createdAt:iso,updatedAt:iso});
  add('shifts','demo-shift-1',{shopId:localShopId,ownerId:localOwnerId,branchName:'Main Demo Branch',cashierName:'Demo Cashier',openingCash:5000,cashSalesTotal:1500,mfsCardSalesTotal:0,cashExpensesTotal:1200,expectedCash:5300,countedCash:5300,variance:0,status:'closed',notes:'Demo shift',createdAt:iso,updatedAt:iso});
  add('staff','demo-staff-1',{shopId:localShopId,ownerId:localOwnerId,name:'Demo Cashier',phone:'01700000000',role:'cashier',branchName:'Main Demo Branch',monthlySalary:12000,pinCode:'1234',isActive:true,createdAt:iso,updatedAt:iso});
  add('purchases','demo-purchase-1',{shopId:localShopId,ownerId:localOwnerId,poNumber:'PO-DEMO-001',supplierId:'demo-supplier-1',supplierName:'Rangamati Wholesale',branchName:'Main Demo Branch',items:[{productId:'demo-rice',name:'Miniket Rice 5kg',sku:'RICE-5KG',unit:'bag',qty:10,unitCost:420,lineTotal:4200}],itemCount:10,totalCost:4200,paidAmount:2000,status:'received',notes:'Demo purchase',createdAt:iso,updatedAt:iso});
  add('srOrders','demo-sr-order-1',{shopId:localShopId,ownerId:localOwnerId,orderNumber:'SR-DEMO-001',srId:'demo-staff-1',srName:'Demo Cashier',routeArea:'Main Market',customerId:'demo-customer-1',customerName:'Rahim Store',retailerShopName:'Rahim Store',customerPhone:'01812345678',items:[{productId:'demo-tea',name:'Premium Tea 400g',sku:'TEA-400',unit:'pack',qty:3,unitPrice:220,costPrice:185,lineTotal:660}],itemCount:3,subtotal:660,discountAmount:0,totalAmount:660,paidAmount:500,dueAmount:160,commissionRate:2,commissionAmount:13.2,paymentMethod:'cash',status:'pending',notes:'Demo field order',createdAt:iso,updatedAt:iso});
  add('ledgerEntries','demo-ledger-1',{shopId:localShopId,ownerId:localOwnerId,partyType:'customer',partyId:'demo-customer-1',partyName:'Rahim Store',entryType:'credit_sale',amount:850,paymentMethod:'credit',reference:'INV-DEMO-009',notes:'Demo opening balance',entryDate:today,createdAt:iso,updatedAt:iso});
  return {shops:{[localShopId]:shop},collections};
}

function load(): LocalData {
  try {
    const raw=localStorage.getItem(storageKey);
    if(raw) { memoryData=JSON.parse(raw) as LocalData; return memoryData; }
  } catch { /* Reset malformed local demo data to the seed workspace. */ }
  if(memoryData) return memoryData;
  const seed=createSeed();
  save(seed);
  return seed;
}
function save(data:LocalData) {
  memoryData=data;
  try { localStorage.setItem(storageKey,JSON.stringify(data)); } catch { /* Keep the demo workspace in memory for this tab. */ }
}

export function listLocalDemo(path:string,filters:[string,string,unknown][]):Record<string,any>[] {
  const state=load();
  const records=path==='shops'
    ? Object.values(state.shops)
    : Object.values(state.collections[path] || {});
  return records.filter((doc) => filters.every(([key,op,value]) => op==='==' && doc[key]===value));
}

export function commitLocalDemo(ops:{type:'set'|'update'|'delete';path:string;data?:any}[]) {
  const state=load();
  for(const op of ops) {
    const parts=op.path.split('/').filter(Boolean);
    if(parts[0]!=='shops') continue;
    if(parts.length===2) {
      const id=parts[1];
      if(op.type==='delete') delete state.shops[id];
      else state.shops[id]={...(op.type==='update'?state.shops[id]:{}),...op.data,id};
      continue;
    }
    if(parts.length<4) continue;
    const id=parts.at(-1)!;
    const collectionPath=parts.slice(0,-1).join('/');
    state.collections[collectionPath] ||= {};
    if(op.type==='delete') delete state.collections[collectionPath][id];
    else state.collections[collectionPath][id]={...(op.type==='update'?state.collections[collectionPath][id]:{}),...op.data,id};
  }
  save(state);
}
