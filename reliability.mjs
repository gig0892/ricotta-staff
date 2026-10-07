export function readStored(storage,key,fallback) {
 const raw=storage.getItem(key);if(raw===null)return fallback;
 try{return JSON.parse(raw);}catch{throw new Error('storage_corrupt');}
}
export function writeStored(storage,key,value) {
 const text=JSON.stringify(value);
 try{storage.setItem(key,text);if(storage.getItem(key)!==text)throw new Error('readback_failed');}
 catch(error){throw new Error('storage_write_failed',{cause:error});}
}
export function safeItems(items) {
 if(!Array.isArray(items))return [];
 return items.map(i=>({name:typeof i?.name==='string'?i.name:'',qty:Number.isInteger(i?.qty)&&i.qty>=1&&i.qty<=99?i.qty:1}));
}
export function validItems(items) {
 return Array.isArray(items)&&items.length>0&&items.length<=50&&items.every(i=>i&&typeof i.name==='string'&&i.name.trim().length>0&&i.name.length<=60&&Number.isInteger(i.qty)&&i.qty>=1&&i.qty<=99);
}
export const hasUnconfirmedPayrollWrite=items=>items.some(x=>x.name==='save_punch'||x.name==='save_staff');
// Browser onLine is a hint; the bounded server probe determines availability.
export function createOnlineGate({probe,onState=()=>{}}) {
 let checking=null;
 return ()=>{
  if(!checking)checking=(async()=>{
   try{if(!await probe())throw Error('connection_required');onState(true);}
   catch(error){onState(false);throw new Error(error.message==='runtime_update_required'?error.message:'connection_required',{cause:error});}
  })().finally(()=>{checking=null;});
  return checking;
 };
}
export function createKioskQueue({storage,send,lookup=async()=>({data:null}),reviewStatus=async()=>[],key='ricotta-kiosk-queue'}) {
 let running=null;
 const read=()=>{const q=readStored(storage,key,[]);if(!Array.isArray(q))throw new Error('storage_corrupt');return q;};
 const write=q=>writeStored(storage,key,q);
 const transportFailure=()=>write(read().map(x=>x.status==='pending'?(x.onlineOnly?{...x,pin:null}:{...x,offline:true}):x));
 async function flushInner(submit){
  const replies={};
  if(read().some(x=>x.status==='review')){
   const resolved=await reviewStatus();
   if(Array.isArray(resolved))write(read().filter(x=>!resolved.some(r=>r.client_id===x.id&&r.resolved)));
  }
  for(const item of read()){
   const confirmOnly=item.onlineOnly&&(item.id!==submit||item.attempted);
   if(item.status==='review'&&!confirmOnly)continue;
   let response;
   try{
    if(confirmOnly)response=await lookup(item);
    else{if(item.onlineOnly)write(read().map(x=>x.id===item.id?{...x,attempted:true}:x));response=await send(item);}
   }catch{transportFailure();return {replies,online:false};}
   const {data,error}=response;
   if(error){
    const permanent=!!error.code&&/^(P0001|22|23|42)/.test(error.code);
    if(!permanent){transportFailure();return {replies,online:false};}
    if(!confirmOnly&&item.offline===false){write(read().filter(x=>x.id!==item.id));replies[item.id]={rejected:true,result:error.message};}
    else write(read().map(x=>x.id===item.id?{...x,status:'review',reason:error.message,pin:null}:x));
    continue;
   }
   const result=data?.result==='duplicate'?data.original_result:data?.result;
   if(['in','out','already_in','out_without_in'].includes(result)&&data.punch_id){
    write(read().filter(x=>x.id!==item.id));replies[item.id]={...data,result};
   }else if(item.offline===false&&['bad_pin','pin_locked','too_old','invalid_time'].includes(result)){
    write(read().filter(x=>x.id!==item.id));replies[item.id]={rejected:true,result};
   }else{
    write(read().map(x=>x.id===item.id?{...x,status:'review',reason:result||'unconfirmed_response',pin:null}:x));
   }
  }
  return {replies,online:true};
 }
 return {
  read,
  acknowledgeReviews(reviews){write(read().filter(x=>!reviews.some(r=>r.client_id===x.id&&r.resolved)).map(x=>reviews.some(r=>r.client_id===x.id)?{...x,status:'review',pin:null}:x));},
  enqueue(item){const q=read();if(q.some(x=>x.staff===item.staff&&(x.status==='review'||x.onlineOnly)))throw new Error('pending_review');if(q.some(x=>x.id===item.id))return;write([...q,{...item,status:'pending'}]);},
  flush({submit=null}={}){if(!running)running=flushInner(submit).finally(()=>{running=null;});return running;}
 };
}
export function createDurableMutations({storage,rpc,lookup=async()=>({data:null}),ensureOnline=async()=>{},actor,key='ricotta-pending-mutations'}) {
 const busy=new Set();
 const read=()=>{const data=readStored(storage,key,[]);if(!Array.isArray(data))throw new Error('storage_corrupt');return data;};
 const remove=id=>writeStored(storage,key,read().filter(x=>x.id!==id));
 const allowed=item=>{if(!['save_order','save_punch','save_staff'].includes(item.name))throw new Error('storage_corrupt');};
 async function execute(item){
  allowed(item);
  const {data,error}=await rpc(item.name,item.args);
  if(error){
   if(error.code&&/^(P0001|22|23|42)/.test(error.code))remove(item.id);
   throw Object.assign(new Error(error.message),error);
  }
  if(!data?.id)throw new Error('unconfirmed_response');
  remove(item.id);return data;
 }
 return {
  pending(){return read().filter(x=>x.owner===actor());},
  async call(name,args,scope){
   const owner=actor(),lock=owner+':'+scope;if(busy.has(lock))throw new Error('save_in_progress');
   busy.add(lock);
   try{
    await ensureOnline();
    const body=JSON.stringify(args);let item=read().find(x=>x.owner===owner&&x.scope===scope);
    if(item&&item.body!==body)throw new Error('pending_submission');
    if(!item){
     const id=crypto.randomUUID();item={id,owner,scope,name,body,args:{...args,p_request:id}};
     writeStored(storage,key,[...read(),item]);
    }
    return await execute(item);
   }finally{busy.delete(lock);}
  },
  async recover(){
   const items=read().filter(x=>x.owner===actor());if(!items.length)return;
   await ensureOnline();
   for(const item of items){
    allowed(item);const {data,error}=await lookup(item.name,item.args);if(error)throw error;
    if(data?.id)remove(item.id);
   }
  },
  async retry(id){
   const item=read().find(x=>x.id===id&&x.owner===actor());if(!item)throw new Error('not_found');
   const lock=item.owner+':'+item.scope;if(busy.has(lock))throw new Error('save_in_progress');
   busy.add(lock);try{await ensureOnline();return await execute(item);}finally{busy.delete(lock);}
  }
 };
}
