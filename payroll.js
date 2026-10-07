// Pay math (BC Employment Standards). Pure functions: no DOM, no network — tested in tests/payroll.test.mjs.
// Dates are 'YYYY-MM-DD' strings in store time (America/Vancouver); instants are epoch ms.

import { TZ, TZDATA_VERSION, local, fromLocal } from './store-time.mjs';
import { cents, payUnits, PAY_DENOMINATOR, settlePay, roundRatio, allocateCents } from './money.mjs';
export { TZ, TZDATA_VERSION, local, fromLocal };
export const LOCS = ['langley', 'burnaby'];
export const OPEN_LIMIT_MS = 18 * 3600e3; // an open shift older than this is a missed clock-out

// ---------- store-time helpers ----------
const utcOf = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const ymdOfUtc = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (s, n) => ymdOfUtc(utcOf(s) + n * 86400e3);
export const dow = (s) => new Date(utcOf(s)).getUTCDay();
export const daysBetween = (a, b) => Math.round((utcOf(b) - utcOf(a)) / 86400e3);
export const weekStart = (s) => addDays(s, -dow(s)); // Sunday

// ---------- BC statutory holidays ----------
function easter(y) { // anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
const nthMonday = (y, mo, n) => { const first = `${y}-${String(mo).padStart(2, '0')}-01`; return addDays(first, ((8 - dow(first)) % 7) + 7 * (n - 1)); };
export function bcStats(y) {
  const may25 = `${y}-05-25`;
  return [
    [`${y}-01-01`, '새해', "New Year's Day"],
    [nthMonday(y, 2, 3), '가족의 날', 'Family Day'],
    [addDays(easter(y), -2), '성금요일', 'Good Friday'],
    [addDays(may25, -(((dow(may25) + 6) % 7) || 7)), '빅토리아 데이', 'Victoria Day'],
    [dow(`${y}-07-01`) === 0 ? `${y}-07-02` : `${y}-07-01`, '캐나다 데이', 'Canada Day'],
    [nthMonday(y, 8, 1), 'BC 데이', 'BC Day'],
    [nthMonday(y, 9, 1), '노동절', 'Labour Day'],
    [`${y}-09-30`, '진실과 화해의 날', 'Truth and Reconciliation'],
    [nthMonday(y, 10, 2), '추수감사절', 'Thanksgiving'],
    [`${y}-11-11`, '현충일', 'Remembrance Day'],
    [`${y}-12-25`, '크리스마스', 'Christmas Day'],
  ].map(([date, ko, en]) => ({ date, ko, en }));
}
const statCache = {};
export function statOn(date) {
  const y = +date.slice(0, 4);
  return (statCache[y] ||= bcStats(y)).find((s) => s.date === date) || null;
}

// ---------- pay periods ----------
export function periodRange(settings, offset, today) {
  const p = settings.period;
  if (p.type === 'biweekly') {
    const k = Math.floor(daysBetween(p.anchor, today) / 14) + offset;
    const start = addDays(p.anchor, k * 14);
    return { start, end: addDays(start, 13) };
  }
  const [y0, m0, d0] = today.split('-').map(Number);
  if (p.type === 'semimonthly') {
    const idx = y0 * 24 + (m0 - 1) * 2 + (d0 <= 15 ? 0 : 1) + offset;
    const y = Math.floor(idx / 24), m = Math.floor((idx % 24) / 2), half = idx % 2;
    const mm = String(m + 1).padStart(2, '0');
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return half ? { start: `${y}-${mm}-16`, end: `${y}-${mm}-${last}` } : { start: `${y}-${mm}-01`, end: `${y}-${mm}-15` };
  }
  const first = new Date(Date.UTC(y0, m0 - 1 + offset, 1)), last = new Date(Date.UTC(y0, m0 + offset, 0));
  return { start: ymdOfUtc(first.getTime()), end: ymdOfUtc(last.getTime()) };
}

// ---------- shifts ----------
// Punch: { id, staffId, loc, inMs, outMs } (inMs or outMs may be null).
export const punchDay = (p) => local(p.inMs ?? p.outMs).ymd;
export function shiftHours(p, settings) {
  if (p.inMs == null || p.outMs == null) return 0;
  let mins = (p.outMs - p.inMs) / 60000;
  const r = +settings.rounding;
  if (r) mins = Math.round(mins / r) * r;
  let h = Math.max(0, mins / 60);
  const b = settings.brk;
  if (b.on && h > b.after) h -= b.minutes / 60;
  return Math.max(0, h);
}
export function isMissing(p, nowMs) {
  if (p.inMs == null) return true;
  return p.outMs == null && nowMs - p.inMs > OPEN_LIMIT_MS;
}


// Weekly accumulation includes the first daily threshold hours of eligible holidays.
export function classify(punches,settings,holidayEligibility={}) {
 const o=settings.ot,st=settings.stat,days={};
 for(const p of punches){
  if(p.inMs==null||p.outMs==null)continue;
  const date=punchDay(p);(days[date]||={date,hours:0,punches:[]});days[date].hours+=shiftHours(p,settings);days[date].punches.push(p);
 }
 const out={},weekHours={};
 for(const date of Object.keys(days).sort()){
  const x=days[date].hours,wk=weekStart(date),before=weekHours[wk]||0;
  const contribution=o.on?Math.min(x,o.d1):x;
  const weekly=o.on?Math.min(contribution,Math.max(0,before+contribution-o.w)):0;
  const state=holidayEligibility[date];
  const stat=st.on&&statOn(date)&&state!=='no'&&state!=='unknown';
  const c={...days[date],reg:x,x15:0,x2:0,stat:0,stat2:0,weekly:0,statWeekly:0,pendingStat:!!(st.on&&statOn(date)&&state==='unknown')};
  if(stat){
   c.reg=0;c.stat=Math.min(x,o.d2);c.stat2=Math.max(0,x-o.d2);c.statWeekly=weekly;
  }else if(o.on){
   c.reg=Math.min(x,o.d1)-weekly;c.weekly=weekly;
   c.x15=Math.max(0,Math.min(x,o.d2)-o.d1)+weekly;c.x2=Math.max(0,x-o.d2);
  }
  weekHours[wk]=before+contribution;out[date]=c;
 }
 return out;
}
export function wageOn(wages,staffId,date){
 const list=wages.filter(w=>w.staffId===staffId&&w.effective<=date).sort((a,b)=>a.effective.localeCompare(b.effective));
 return list.length?+list.at(-1).wage:0;
}
export function dayPayUnits(c,wage,settings){
 const o=settings.ot,s=settings.stat,weekly=c.weekly||0,sw=c.statWeekly||0;
 return payUnits(c.reg,wage)+payUnits(c.x15-weekly,wage,o.d1x)+payUnits(weekly,wage,o.wx)
  +payUnits(c.x2,wage,o.d2x)+payUnits(c.stat-sw,wage,s.x)+payUnits(sw,wage,Math.max(s.x,o.wx))
  +payUnits(c.stat2,wage,o.d2x);
}
export const dayGross=(c,wage,settings)=>Number(dayPayUnits(c,wage,settings))/Number(PAY_DENOMINATOR)/100;
export function statEligibility(staff,days,settings,date,review){
 const from=addDays(date,-30),start=staff.start_date||staff.startDate;
 if(start&&daysBetween(start,date)<30)return 'no';
 const worked=Object.values(days).filter(c=>c.date>=from&&c.date<date&&c.hours>0).length;
 if(start&&worked>=15)return 'yes';
 if(review&&typeof review.qualified==='boolean')return review.qualified?'yes':'no';
 if(!start||!settings.startedAt||settings.startedAt>from)return 'unknown';
 if(review?.qualified===true)return 'yes';
 return 'unknown';
}
export function statBasis({staff,days,wages,settings,date}){
 return JSON.stringify({date,start:staff.start_date||staff.startDate||null,startedAt:settings.startedAt,
  rules:{ot:settings.ot,stat:settings.stat,brk:settings.brk,rounding:settings.rounding},
  days:Object.values(days).filter(c=>c.date>=addDays(date,-30)&&c.date<date).sort((a,b)=>a.date.localeCompare(b.date)).map(c=>[c.date,c.hours,c.reg,c.x15,c.x2,c.stat,c.stat2,c.weekly||0]),
  wages:wages.filter(w=>w.staffId===staff.id&&w.effective<date).map(w=>[w.effective,w.wage]).sort()});
}
export function statAverage({staff,days,wages,settings,date,review}){
 const basis=statBasis({staff,days,wages,settings,date});
 const valid=review&&review.basis===basis;
 const qualified=statEligibility(staff,days,settings,date,valid?review:null);
 if(qualified==='no')return {date,status:'no',qualified,amount:0,basis,daysWorked:0};
 const worked=Object.values(days).filter(c=>c.date>=addDays(date,-30)&&c.date<date&&c.hours>0);
 const regularUnits=worked.reduce((n,c)=>n+payUnits(c.reg,wageOn(wages,staff.id,c.date))
  +payUnits(c.stat,wageOn(wages,staff.id,c.date),settings.stat.x),0n);
 const estimate=worked.length?roundRatio(regularUnits,PAY_DENOMINATOR*BigInt(worked.length))/100:0;
 if(valid&&review.qualified===true)return {date,status:'yes',qualified:'yes',amount:review.amount,basis,daysWorked:worked.length,reviewed:true};
 return {date,status:'unknown',qualified,amount:0,estimate,basis,daysWorked:worked.length};
}
export function payroll({staff,wages,punches,settings,tips,range,nowMs,locFilter='all',statReviews=[]}){
 const inRange=d=>d>=range.start&&d<=range.end,byStaff={};
 for(const p of punches)(byStaff[p.staffId]||=[]).push(p);
 const tipShare={},tipIssues=[];
 if(settings.tipsOn)for(const loc of LOCS){
  const pool=+(tips[range.start+'|'+loc]||0);if(!pool)continue;
  const hours={};
  for(const p of punches)if(p.loc===loc&&inRange(punchDay(p))){
   const h=shiftHours(p,settings);if(h>0)hours[p.staffId]=(hours[p.staffId]||0)+h;
  }
  const weights=Object.fromEntries(Object.entries(hours).map(([id,h])=>[id,settings.tipMethod==='equal'?1:h]));
  if(!Object.keys(weights).length){tipIssues.push('unallocated_tips:'+loc);continue;}
  for(const [id,amount]of Object.entries(allocateCents(pool,weights)))tipShare[id]=(cents(tipShare[id]||0)+cents(amount))/100;
 }
 const stats=[];for(let d=range.start;d<=range.end;d=addDays(d,1))if(statOn(d))stats.push(d);
 const rows=[];
 for(const s of staff){
  if(locFilter!=='all'&&s.loc!==locFilter&&s.loc!=='both')continue;
  const mine=byStaff[s.id]||[],raw=classify(mine,settings),eligibility={},reviewMap={};
  for(const date of [...new Set([...Object.keys(raw).filter(d=>statOn(d)),...stats])]){
   const review=statReviews.find(r=>r.staff_id===s.id&&r.date===date);
   const basis=statBasis({staff:s,days:raw,wages,settings,date});
   reviewMap[date]=review?.basis===basis?review:null;
   eligibility[date]=statEligibility(s,raw,settings,date,reviewMap[date]);
  }
  const all=classify(mine,settings,eligibility),days=Object.values(all).filter(c=>inRange(c.date));
  const sum=k=>days.reduce((n,c)=>n+(c[k]||0),0);
  const gross=settlePay(days.reduce((n,c)=>n+dayPayUnits(c,wageOn(wages,s.id,c.date),settings),0n))/100;
  const statAvg=settings.stat.on&&settings.stat.avgDay?stats.map(date=>statAverage({staff:s,days:raw,wages,settings,date,review:reviewMap[date]})):[];
  const statAvgTotal=statAvg.reduce((n,x)=>n+cents(x.amount),0)/100;
  const vac=settings.vac?.on?roundRatio(BigInt(cents(gross)+cents(statAvgTotal))*BigInt(Math.round(settings.vac.pct*100)),10000n)/100:0;
  const missing=mine.filter(p=>inRange(punchDay(p))&&(p.inMs==null||p.outMs==null)).length;
  const wagesUsed=[...new Set(days.map(c=>wageOn(wages,s.id,c.date)))];
  const tip=tipShare[s.id]||0,issues=[];
  if(missing)issues.push('missing_punch');
  if(days.some(c=>wageOn(wages,s.id,c.date)<=0))issues.push('missing_wage');
  if(statAvg.some(x=>x.status==='unknown')||days.some(c=>c.pendingStat))issues.push('stat_review');
  if(mine.some(p=>inRange(punchDay(p))&&p.inMs!=null&&p.outMs!=null&&local(p.inMs).ymd!==local(p.outMs-1).ymd))issues.push('overnight_review');
  const sorted=mine.filter(p=>p.inMs!=null&&p.outMs!=null).sort((a,b)=>a.inMs-b.inMs);
  if(sorted.some((p,i)=>i&&p.inMs<sorted[i-1].outMs&&inRange(punchDay(p))))issues.push('overlap');
  if(!days.length&&!missing&&!tip&&!statAvg.some(x=>x.status!=='no'))continue;
  rows.push({staff:s,days,reg:sum('reg'),x15:sum('x15'),x2:sum('x2'),weekly:sum('weekly'),statWeekly:sum('statWeekly'),
   stat:sum('stat'),stat2:sum('stat2'),hours:sum('hours'),wage:wagesUsed.length===1?wagesUsed[0]:wageOn(wages,s.id,range.end),wagesUsed,
   noWage:issues.includes('missing_wage'),gross,statAvg,statAvgTotal,vac,tips:tip,
   total:(cents(gross)+cents(statAvgTotal)+cents(vac)+cents(tip))/100,missing,issues});
 }
 return {range,rows,stats,issues:tipIssues,ready:!tipIssues.length&&rows.every(r=>!r.issues.length)};
}
