// Runs every 15 min in GitHub Actions: asks the database what is due and sends web push.
// Secrets: REMINDER_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY. Customer details never go to the log.
import webpush from 'web-push';

const { SUPABASE_URL, SUPABASE_KEY, REMINDER_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, TEST } = process.env;
webpush.setVapidDetails('https://gig0892.github.io/ricotta-staff/', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

async function rpc(fn, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${fn} ${r.status}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

const due = await rpc('due_reminders', { p_secret: REMINDER_SECRET, p_test: TEST === 'true' });
const line = (o) => [o.time, o.customer, (o.items || []).map((i) => i.name + (i.qty > 1 ? ` ×${i.qty}` : '')).join(', ')].filter(Boolean).join(' · ');
let sent = 0, gone = 0, failed = 0;
for (const s of due.subs) {
  const mine = (list) => list.filter((o) => !s.loc || o.loc === s.loc);
  const msgs = [];
  if (due.test) msgs.push({ title: 'Cafe Ricotta 알림 테스트', body: '이 기기에서 케이크 예약 알림을 받을 수 있어요.' });
  const tm = mine(due.tomorrow), td = mine(due.today);
  if (tm.length) msgs.push({ title: `내일 케이크 픽업 ${tm.length}건`, body: tm.map(line).join('\n') });
  if (td.length) msgs.push({ title: `오늘 케이크 픽업 ${td.length}건`, body: td.map(line).join('\n') });
  for (const m of msgs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...m, url: './#orders' }), { TTL: 6 * 3600 });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { await rpc('push_gone', { p_secret: REMINDER_SECRET, p_endpoint: s.endpoint }); gone++; } else failed++;
    }
  }
}
console.log(`orders tomorrow=${due.tomorrow.length} today=${due.today.length} · devices=${due.subs.length} · sent=${sent} removed=${gone} failed=${failed}`);
if (failed) process.exitCode = 1;
