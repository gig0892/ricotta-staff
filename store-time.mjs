import moment, { tzdataVersion } from './vendor/vancouver-tz.js';
export const TZ = 'America/Vancouver';
export const TZDATA_VERSION = tzdataVersion;
export function local(ms) {
  if (!Number.isFinite(ms)) throw new Error('invalid_time');
  const m=moment.tz(ms,TZ);
  return {ymd:m.format('YYYY-MM-DD'),hm:m.format('HH:mm')};
}
// Reject missing/ambiguous wall times rather than silently moving a payroll entry.
export function fromLocal(ymd,hm) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(ymd)||!/^\d{2}:\d{2}$/.test(hm))throw new Error('invalid_time');
  const text=ymd+' '+hm,m=moment.tz(text,'YYYY-MM-DD HH:mm',true,TZ);
  if(!m.isValid()||m.format('YYYY-MM-DD HH:mm')!==text)throw new Error('nonexistent_local_time');
  const zone=moment.tz.zone(TZ),[y,mo,d]=ymd.split('-').map(Number),[h,mi]=hm.split(':').map(Number);
  const wall=Date.UTC(y,mo-1,d,h,mi);
  const matches=[...new Set(zone.offsets)].map(off=>wall+off*60000).filter(t=>{
    const x=local(t);return x.ymd===ymd&&x.hm===hm;
  });
  if(matches.length!==1)throw new Error('ambiguous_local_time');
  return matches[0];
}
