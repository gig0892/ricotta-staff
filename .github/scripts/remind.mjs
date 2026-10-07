import webpush from 'web-push';
import {deliverReminders} from './reminder-core.mjs';
// Production worker; credentials remain in the existing GitHub Actions secrets.
const {SUPABASE_URL,SUPABASE_KEY,REMINDER_SECRET,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY,TEST}=process.env;
webpush.setVapidDetails('https://gig0892.github.io/ricotta-staff/',VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);
async function rpc(fn,body){
 const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok)throw new Error(fn+' '+r.status);const text=await r.text();return text?JSON.parse(text):null;
}
if(TEST==='true'){
 const due=await rpc('due_reminders',{p_secret:REMINDER_SECRET,p_test:true});let sent=0;
 for(const s of due.subs){
  await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title:'Cafe Ricotta 알림 테스트',body:'이 기기에서 예약 알림을 받을 수 있어요.',tag:'ricotta-test',url:'./#orders'}),{TTL:3600});sent++;
 }
 console.log(JSON.stringify({testSent:sent}));
}else{
 const counts=await deliverReminders({rpc,send:(...args)=>webpush.sendNotification(...args),secret:REMINDER_SECRET});
 console.log(JSON.stringify(counts));if(counts.failed)process.exitCode=1;
}
