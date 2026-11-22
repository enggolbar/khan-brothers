import { isLocalDemoSession } from './authClient';
import { commitLocalDemo, listLocalDemo } from './localDemoStore';

export class DbTimestamp {
  constructor(private readonly value: string | number | Date) {}
  toDate(): Date { return new Date(this.value); }
  toMillis(): number { return this.toDate().getTime(); }
}
const stampMarker = '__mysqlServerTimestamp';
export const serverTimestamp = () => ({ [stampMarker]: true });
export type Ref = { path: string; id: string };
export type QueryRef = { path: string; filters: [string,string,unknown][] };
type DocumentData = Record<string, any>;
type DocumentSnapshot = { id: string; data: () => DocumentData; exists: () => boolean };
type QuerySnapshot = { docs: DocumentSnapshot[]; empty: boolean; size: number };
export const db = {};
export const collection = (_db: unknown, ...parts: string[]): QueryRef => ({ path:parts.join('/'), filters:[] });
export const doc = (_db: unknown, ...parts: string[]): Ref => { const path=parts.join('/'); return {path,id:parts.at(-1)||''}; };
export const where = (key:string, op:string, value:unknown) => ({ key, op, value });
export const query = (ref:QueryRef, ...filters: {key:string;op:string;value:unknown}[]):QueryRef => ({ ...ref, filters:filters.map((f)=>[f.key,f.op,f.value]) });

async function request<T>(url:string, init:RequestInit = {}):Promise<T> {
  const response=await fetch(url,{...init,credentials:'include',headers:{'Content-Type':'application/json',...init.headers}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(body.error||`Server error (${response.status})`);
  return body as T;
}
function hydrate(value:any):any {
  if(Array.isArray(value)) return value.map(hydrate);
  if(value && typeof value==='object') {
    const keys=Object.keys(value);
    if(keys.length===1 && keys[0]===stampMarker) return new DbTimestamp(new Date());
    if(keys.length===1 && keys[0]==='__timestamp') return new DbTimestamp(value.__timestamp);
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[
      k,
      (k === 'createdAt' || k === 'updatedAt') && typeof v === 'string'
        ? new DbTimestamp(v)
        : hydrate(v),
    ]));
  }
  return value;
}
function serialize(value:any):any {
  if(Array.isArray(value)) return value.map(serialize);
  if(value && typeof value==='object') {
    if(value[stampMarker]) return new Date().toISOString();
    if(value instanceof DbTimestamp) return value.toDate().toISOString();
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,serialize(v)]));
  }
  return value;
}
async function list(ref:QueryRef):Promise<any[]> {
 if(isLocalDemoSession()) return listLocalDemo(ref.path,ref.filters).map(hydrate);
 const params=new URLSearchParams({path:ref.path,where:JSON.stringify(ref.filters)});
 return (await request<any[]>(`/api/docs?${params}`)).map(hydrate);
}
function snap(docs:DocumentData[]):QuerySnapshot { return {docs:docs.map((data)=>({id:data.id,data:()=>data,exists:()=>true})),empty:docs.length===0,size:docs.length}; }
export function onSnapshot(ref:QueryRef, next:(value:QuerySnapshot)=>void, error?:(e:unknown)=>void):()=>void {
 let stopped=false, running=false, signature='';
 const poll=async()=>{ if(stopped||running)return; running=true; try {const rows=await list(ref);const key=JSON.stringify(rows,(k,v)=>v instanceof DbTimestamp?v.toMillis():v);if(key!==signature){signature=key;next(snap(rows));}}catch(e){error?.(e);}finally{running=false;} };
 void poll(); const timer=window.setInterval(poll,4000); return ()=>{stopped=true;window.clearInterval(timer);};
}
type Operation={type:'set'|'update'|'delete';path:string;data?:any};
export function writeBatch(_db:unknown) {
 const ops:Operation[]=[];
 return {set(ref:Ref,data:any){ops.push({type:'set',path:ref.path,data:serialize(data)});return this;},update(ref:Ref,data:any){ops.push({type:'update',path:ref.path,data:serialize(data)});return this;},delete(ref:Ref){ops.push({type:'delete',path:ref.path});return this;},async commit(){if(isLocalDemoSession()){commitLocalDemo(ops);return;}await request('/api/batch',{method:'POST',body:JSON.stringify({ops})});}};
}
export async function setDoc(ref:Ref,data:any){const op={type:'set' as const,path:ref.path,data:serialize(data)};if(isLocalDemoSession()){commitLocalDemo([op]);return;}await request('/api/batch',{method:'POST',body:JSON.stringify({ops:[op]})});}
export async function updateDoc(ref:Ref,data:any){const op={type:'update' as const,path:ref.path,data:serialize(data)};if(isLocalDemoSession()){commitLocalDemo([op]);return;}await request('/api/batch',{method:'POST',body:JSON.stringify({ops:[op]})});}
export async function deleteDoc(ref:Ref){const op={type:'delete' as const,path:ref.path};if(isLocalDemoSession()){commitLocalDemo([op]);return;}await request('/api/batch',{method:'POST',body:JSON.stringify({ops:[op]})});}
