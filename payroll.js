// Pay math (BC Employment Standards). Pure functions: no DOM, no network — tested in tests/payroll.test.mjs.
// Dates are 'YYYY-MM-DD' strings in store time (America/Vancouver); instants are epoch ms.

export const TZ = 'America/Vancouver';
export const LOCS = ['langley', 'burnaby'];
export const OPEN_LIMIT_MS = 18 * 3600e3; // an open shift older than this is a missed clock-out

// ---------- store-time helpers ----------
const dtf = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function local(ms) {
  const o = {};
  for (const p of dtf.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { ymd: `${o.year}-${o.month}-${o.day}`, hm: `${o.hour}:${o.minute}` };
}
// Store-local date + 'HH:MM' -> epoch ms.
export function fromLocal(ymd, hm) {
  const [y, m, d] = ymd.split('-').map(Number), [H, M] = hm.split(':').map(Number);
  const want = Date.UTC(y, m - 1, d, H, M);
  let t = want;
  for (let i = 0; i < 3; i++) {
    const l = local(t), [ly, lm, ld] = l.ymd.split('-').map(Number), [lH, lM] = l.hm.split(':').map(Number);
    t += want - Date.UTC(ly, lm - 1, ld, lH, lM);
  }
  return t;
}
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
    [`${y}-07-01`, '캐나다 데이', 'Canada Day'],
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

// Split each worked day of one person into regular / 1.5x / 2x / stat hours.
export function classify(punches, settings) {
  const o = settings.ot, st = settings.stat, days = {};
  for (const p of punches) {
    if (p.inMs == null || p.outMs == null) continue;
    const d = punchDay(p);
    (days[d] ||= { date: d, hours: 0, punches: [] });
    days[d].hours += shiftHours(p, settings);
    days[d].punches.push(p);
  }
  const out = {}, weekReg = {};
  for (const d of Object.keys(days).sort()) {
    const x = days[d].hours;
    const c = { ...days[d], reg: x, x15: 0, x2: 0, stat: 0, stat2: 0 };
    if (st.on && statOn(d)) {
      // Worked a stat: first d2 hours at the stat rate, the rest at the 2x rate. Not counted toward the week.
      c.reg = 0;
      c.stat = o.on ? Math.min(x, o.d2) : x;
      c.stat2 = o.on ? Math.max(0, x - o.d2) : 0;
    } else if (o.on) {
      c.reg = Math.min(x, o.d1);
      c.x15 = Math.max(0, Math.min(x, o.d2) - o.d1);
      c.x2 = Math.max(0, x - o.d2);
      const wk = weekStart(d), before = weekReg[wk] || 0, over = Math.max(0, before + c.reg - o.w);
      if (over > 0) { c.reg -= over; c.x15 += over; }
      weekReg[wk] = before + c.reg;
    }
    out[d] = c;
  }
  return out;
}

// Wage on a given day: the latest entry that started on or before it (or the earliest one).
export function wageOn(wages, staffId, date) {
  const list = wages.filter((w) => w.staffId === staffId).sort((a, b) => a.effective.localeCompare(b.effective));
  if (!list.length) return 0;
  let w = list[0].wage;
  for (const x of list) if (x.effective <= date) w = x.wage;
  return +w;
}
export const dayGross = (c, wage, settings) =>
  wage * (c.reg + c.x15 * settings.ot.d1x + c.x2 * settings.ot.d2x + c.stat * settings.stat.x + c.stat2 * settings.ot.d2x);

// BC average day's pay for a stat holiday: employed 30 days and worked 15 of the 30 days before it.
// 'unknown' when the app has not been running long enough to tell.
export function statAverage({ staff, days, wages, settings, date }) {
  const from = addDays(date, -30), to = addDays(date, -1);
  if (staff.startDate && daysBetween(staff.startDate, date) < 30) return { date, status: 'no', amount: 0 };
  const worked = Object.values(days).filter((c) => c.date >= from && c.date <= to && c.hours > 0);
  if (worked.length >= 15) {
    const earned = worked.reduce((a, c) => a + dayGross(c, wageOn(wages, staff.id, c.date), settings), 0);
    return { date, status: 'yes', amount: earned / worked.length, daysWorked: worked.length };
  }
  if (settings.startedAt && settings.startedAt > from) return { date, status: 'unknown', amount: 0, daysWorked: worked.length };
  return { date, status: 'no', amount: 0, daysWorked: worked.length };
}

// Whole pay period. punches must cover at least 31 days before range.start (stat averages, weekly OT).
export function payroll({ staff, wages, punches, settings, tips, range, nowMs, locFilter = 'all' }) {
  const inRange = (d) => d >= range.start && d <= range.end;
  const byStaff = {};
  for (const p of punches) (byStaff[p.staffId] ||= []).push(p);

  const tipShare = {};
  if (settings.tipsOn) for (const loc of LOCS) {
    const pool = +(tips[`${range.start}|${loc}`] || 0);
    if (!pool) continue;
    const hours = {};
    for (const p of punches) if (p.loc === loc && inRange(punchDay(p))) {
      const h = shiftHours(p, settings);
      if (h > 0) hours[p.staffId] = (hours[p.staffId] || 0) + h;
    }
    const ids = Object.keys(hours), total = ids.reduce((a, id) => a + hours[id], 0);
    for (const id of ids) tipShare[id] = (tipShare[id] || 0) + (settings.tipMethod === 'equal' ? pool / ids.length : pool * hours[id] / total);
  }

  const stats = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) if (statOn(d)) stats.push(d);

  const rows = [];
  for (const s of staff) {
    if (locFilter !== 'all' && s.loc !== locFilter && s.loc !== 'both') continue;
    const mine = byStaff[s.id] || [];
    const all = classify(mine, settings);
    const days = Object.values(all).filter((c) => inRange(c.date));
    const sum = (k) => days.reduce((a, c) => a + c[k], 0);
    const gross = days.reduce((a, c) => a + dayGross(c, wageOn(wages, s.id, c.date), settings), 0);
    const statAvg = settings.stat.on && settings.stat.avgDay
      ? stats.map((date) => ({ ...statAverage({ staff: s, days: all, wages, settings, date }), wage: wageOn(wages, s.id, date) }))
      : [];
    const statAvgTotal = statAvg.reduce((a, x) => a + x.amount, 0);
    const vac = settings.vac?.on ? (gross + statAvgTotal) * settings.vac.pct / 100 : 0;
    const missing = mine.filter((p) => inRange(punchDay(p)) && isMissing(p, nowMs)).length;
    const wagesUsed = [...new Set(days.map((c) => wageOn(wages, s.id, c.date)))];
    const tip = tipShare[s.id] || 0;
    const hasStatPay = statAvg.some((x) => x.status === 'yes' || (x.status === 'unknown' && x.daysWorked > 0));
    if (!days.length && !missing && !tip && !hasStatPay) continue;
    rows.push({
      staff: s, days, reg: sum('reg'), x15: sum('x15'), x2: sum('x2'), stat: sum('stat'), stat2: sum('stat2'), hours: sum('hours'),
      wage: wageOn(wages, s.id, range.end), wagesUsed, noWage: !wages.some((w) => w.staffId === s.id),
      gross, statAvg, statAvgTotal, vac, tips: tip, total: gross + statAvgTotal + vac + tip, missing,
    });
  }
  return { range, rows, stats };
}
