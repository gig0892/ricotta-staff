// Transport-injected worker. Tests exercise this same delivery/acknowledgment path.
export async function deliverReminders({rpc,send,secret}) {
 const due=await rpc('due_reminders',{p_secret:secret,p_test:false});
 let sent=0,failed=0,gone=0;
 for(const claimed of due.deliveries||[]){
  const d=await rpc('reminder_delivery',{p_secret:secret,p_id:claimed.id,p_claim:claimed.claim});
  if(!d)continue;
  const o=d.order,items=Array.isArray(o.items)?o.items:[];
  const body=[o.date,o.time,o.customer,items.filter(i=>i&&typeof i.name==='string'&&Number.isInteger(i.qty)).map(i=>i.name+' ×'+i.qty).join(', ')||'예약 내용을 확인해 주세요'].filter(Boolean).join(' · ');
  try{
   await send({endpoint:d.endpoint,keys:d.keys},JSON.stringify({title:'Cafe Ricotta 케이크 픽업',body,tag:'ricotta-'+d.id,url:'./#orders'}),{TTL:6*3600});
  }catch(e){
   failed++;
   if([404,410].includes(e.statusCode)){await rpc('push_gone',{p_secret:secret,p_endpoint:d.endpoint});gone++;}
   else await rpc('finish_reminder',{p_secret:secret,p_id:d.id,p_claim:d.claim,p_ok:false,p_error:String(e.statusCode||'send_failed')});
   continue;
  }
  // If acknowledgment fails, keep the lease/record. Later retries use the same notification tag.
  if(!await rpc('finish_reminder',{p_secret:secret,p_id:d.id,p_claim:d.claim,p_ok:true,p_error:null}))throw new Error('reminder_ack_conflict');
  sent++;
 }
 return {sent,failed,gone};
}
