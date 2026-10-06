// Cafe Ricotta staff & payroll — one page, three faces:
//   kiosk  : the store iPad (device token, no login) — staff tap name (+PIN) to clock in/out
//   login  : owner / managers sign in
//   admin  : today, timesheet, payroll (owner), staff, settings
import * as P from './payroll.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hrs = (n) => (Math.round(n * 100) / 100).toFixed(2);
const initial = (name) => (name || '?').trim().slice(0, 1).toUpperCase();
const hmOf = (ms) => (ms == null ? '—' : P.local(ms).hm);
const today = () => P.local(Date.now()).ymd;
const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const K_PREFS = 'ricotta-prefs', K_DEVICE = 'ricotta-device', K_CACHE = 'ricotta-kiosk-cache', K_QUEUE = 'ricotta-kiosk-queue';

// ---------- text ----------
const TXT = {
  ko: {
    sub: '근무·급여', all: '전체', langley: '랭리', burnaby: '버나비', both: '두 지점',
    tabToday: '오늘', tabCards: '근무기록', tabPay: '급여', tabStaff: '직원', tabSet: '설정',
    dow: ['일', '월', '화', '수', '목', '금', '토'],
    notConfigured: '서버 주소가 아직 설정되지 않았어요. config.js를 확인하세요.',
    // auth
    email: '이메일', password: '비밀번호', signIn: '로그인', signUp: '계정 만들기', haveAccount: '이미 계정이 있어요', needAccount: '계정이 없어요',
    forgot: '비밀번호를 잊었어요', sendReset: '재설정 메일 보내기', resetSent: '비밀번호 재설정 메일을 보냈어요. 메일의 링크를 눌러주세요.',
    newPw: '새 비밀번호', setPw: '비밀번호 바꾸기', pwChanged: '비밀번호를 바꿨어요.', pwShort: '비밀번호는 8자 이상이어야 해요.',
    firstRun: '처음 설정이에요. 사장님 이메일로 계정을 만들면 그 계정이 사장님(관리자) 계정이 돼요.',
    checkMail: '확인 메일을 보냈어요. 메일의 링크를 누른 다음 여기서 로그인하세요.',
    authFail: '이메일이나 비밀번호가 맞지 않아요. 처음이라면 아래 [계정이 없어요]를 눌러 계정부터 만드세요.', backToClock: '← 출퇴근 화면으로',
    noAccess: '아직 팀에 등록되지 않은 계정이에요', noAccessD: '사장님이 설정 → 팀에서 {e} 를 초대하면 바로 들어올 수 있어요.', retry: '다시 확인', signOut: '로그아웃',
    deviceRevoked: '이 기기의 출퇴근 등록이 해제됐어요. 관리자 로그인 후 다시 등록하세요.',
    // kiosk
    tapName: '이름을 누르세요', clockIn: '출근하기', clockOut: '퇴근하기', working: '근무 중', since: '{t}부터 근무 중', off: '퇴근 상태',
    enterPin: 'PIN 4자리를 누르세요', wrongPin: 'PIN이 틀렸어요', pinLocked: 'PIN을 여러 번 틀려서 5분 동안 막혔어요.',
    doneIn: '출근', doneOut: '퇴근', doneHours: '오늘 {h}시간 근무', already: '이미 출근 중이에요 ({t}부터)', outNoIn: '출근 기록이 없어서 퇴근만 저장했어요. 사장님이 확인할 거예요.',
    savedOffline: '인터넷이 끊겨서 이 기기에 저장했어요. 연결되면 자동으로 올라가요.', tapToClose: '화면을 누르면 닫혀요',
    onNow: '지금 근무 중', nobody: '지금 근무 중인 사람이 없어요.', todayLog: '오늘 기록', noToday: '오늘 기록이 아직 없어요.',
    noStaffK: '이 지점에 등록된 직원이 없어요', noStaffKD: '관리자 로그인 → 직원에서 등록하세요.',
    online: '연결됨', offline: '오프라인', queued: '올라갈 기록 {n}건', admin: '관리자', cancel: '취소', del: '지우기',
    // admin
    kioskBanner: '이 아이패드는 매장 출퇴근 기기예요. 관리 화면은 5분 동안 안 쓰면 자동으로 닫혀요.', toKiosk: '출퇴근 화면으로',
    guideTitle: '이렇게 시작해요', g1: '직원 등록', g1d: '이름, 시급, PIN(선택)을 넣어요.', g2: '매장 아이패드 등록', g2d: '아이패드에서 로그인 → 설정 → "이 기기를 출퇴근 기기로 등록".', g3: '출퇴근 시작', g3d: '직원은 아이패드에서 이름 누르고 출근/퇴근. 급여는 자동 계산돼요.',
    statSoon: '다가오는 공휴일', statInDays: '{n}일 후', statTodayTag: '오늘', statElig: '공휴일 수당 대상', statSoFar: '지금까지 {n}일 근무 · 15일 필요', statNo: '대상 아님 · {n}일 근무', statNew: '입사 30일 미만', statCheck: '앱 사용 전 기록 필요 — 직접 확인 ({n}일 기록됨)',
    statRule: 'BC 기준: 입사 30일 이상이고 공휴일 전 30일 중 15일 이상 일한 직원은 공휴일 평균 일당을 받아요. 공휴일에 일하면 그와 별도로 일한 시간은 1.5배예요. 앱이 근무기록으로 날짜를 세서 급여에 자동으로 넣어요.',
    missingAlert: '확인이 필요한 기록이 {n}건 있어요 (퇴근 누락 등).', fix: '고치러 가기',
    devicesNow: '매장 기기', lastSeen: '마지막 연결 {t}', never: '아직 연결 안 됨', ago: '{n}분 전', agoH: '{n}시간 전', agoD: '{n}일 전', justNow: '방금',
    cardsTitle: '근무기록', allStaff: '전체 직원', onlyIssues: '확인 필요만', addRecord: '기록 추가', cardsHint: '기록을 누르면 시간을 고칠 수 있어요. 누가 언제 왜 고쳤는지 모두 남아요.',
    noCards: '근무기록이 없어요', noCardsD: '매장 아이패드에서 출퇴근하면 여기에 쌓여요.', loadMore: '이전 기록 더 보기',
    missingOut: '퇴근 누락', missingIn: '출근 누락', edited: '수정됨', manualTag: '직접 입력', staff: '직원', loc: '지점', date: '날짜', inT: '출근', outT: '퇴근',
    note: '메모', notePh: '예: 마감 청소로 30분 늦게 퇴근', reason: '수정 이유', reasonPh: '예: 퇴근 안 찍음', save: '저장', needTime: '날짜와 출근 또는 퇴근 시간을 넣어주세요.', saved: '저장했어요', deleted: '지웠어요', delQ: '이 기록을 지울까요? (이력은 남아요)',
    history: '변경 이력', kioskActor: '매장 아이패드', manual: '직접 수정', none: '없음', loading: '불러오는 중…',
    actCreate: '추가', actUpdate: '수정', actDelete: '삭제', actRestore: '복구', actKiosk: '출퇴근 찍음',
    payTitle: '급여', prev: '이전 기간', next: '다음 기간', thisPeriod: '이번 기간',
    totalHours: '총 근무시간', totalPay: '지급 합계 (세전)', toCheck: '확인 필요', checkNone: '빠진 기록 없음', checkSome: '확인 필요 {n}건 — 계산에서 빠져 있어요',
    reg: '일반', ot15: '초과 1.5배', ot2: '초과 2배', stat: '공휴일 근무', stat2: '공휴일 12h 초과', tips: '팁', wage: '시급', gross: '급여', vac: '휴가수당', statAvg: '공휴일 수당',
    statYes: '{d} 공휴일 수당 {a}', statUnknown: '{d} 공휴일 수당: 앱 사용 전 기록이 필요해요 — 직접 확인', noWage: '시급 없음', wageChanged: '기간 중 시급 변경',
    noPay: '이 기간에 근무 기록이 없어요.', tapDetail: '직원을 누르면 날짜별 내역이 보여요.',
    tipsTitle: '이 기간 팁 총액', tipsHint: 'Square를 연결하면 자동으로 들어와요. 지금은 지점별 총액을 넣으면 {m} 나눠요.', byHours: '근무시간 비율로', equally: '똑같이',
    copy: '엑셀용 표 복사', copied: '복사했어요. 엑셀에 붙여넣으면 표로 들어가요.', selected: '아래 표를 선택했어요. 복사해서 엑셀에 붙여넣으세요.',
    csvSum: '요약 CSV 받기', csvDetail: '상세 CSV 받기 (회계사용)',
    ruleNote: 'BC주 기준: 하루 {d1}시간 넘으면 {x1}배, {d2}시간 넘으면 {x2}배, 주(일–토) {w}시간 넘으면 {wx}배, 공휴일 근무 {sx}배. 세금·CPP·EI 공제 전 금액이에요. 규칙은 설정에서 바꿀 수 있어요.',
    staffTitle: '직원', staffCount: '{n}명', addStaff: '직원 등록', name: '이름', role: '역할', rolePh: '예: 바리스타', wageL: '시급 ($)', startDate: '입사일 (선택)',
    pin: '출퇴근 PIN', pinSet: '설정됨', pinNone: '없음', pinNew: '새 PIN 4자리', pinClear: 'PIN 없애기', pinHint: 'PIN이 있으면 다른 사람이 대신 찍을 수 없어요. 없으면 이름만 눌러서 찍어요.', pinBad: 'PIN은 숫자 4자리예요.',
    active: '근무 중인 직원', inactive: '퇴사/휴직', activeHint: '끄면 출퇴근 화면에서 숨겨져요. 기록은 남아요.', needName: '이름을 넣어주세요.', added: '{n} 등록했어요', last7: '최근 7일 {h}시간', perHour: '/시간',
    wageHist: '시급 이력', wageNew: '시급 변경', wageFrom: '적용 시작일', wageAdd: '변경 저장', wageNeed: '시급과 시작일을 넣어주세요.',
    setTitle: '설정', thisDevice: '이 기기', isKiosk: '이 기기는 "{n}" 출퇴근 기기로 등록돼 있어요.', openKiosk: '출퇴근 화면 열기',
    regDevice: '이 기기를 매장 출퇴근 기기로 등록', regDeviceD: '매장 아이패드에서 누르세요. 등록하면 로그아웃되고 출퇴근 화면만 보여요. 직원은 급여나 시급을 볼 수 없어요.',
    devName: '기기 이름', devNamePh: '예: 랭리 카운터 아이패드', register: '등록하기', registered: '등록했어요. 출퇴근 화면으로 바뀝니다.',
    devices: '등록된 출퇴근 기기', noDevices: '아직 없어요.', revoke: '해제', revokeQ: '이 기기를 해제할까요? 그 기기에서는 출퇴근을 못 찍게 돼요.', revoked: '해제했어요', revokedTag: '해제됨',
    team: '팀', teamD: '초대한 이메일로 이 주소에서 계정을 만들면 바로 들어와요. 매니저는 근무기록과 직원은 관리하지만 시급·급여·설정은 못 봐요.',
    owner: '사장', manager: '매니저', invite: '초대', invited: '초대 대기', invitedOk: '초대했어요. 이 주소를 알려주세요: {u}', remove: '빼기', removeQ: '팀에서 뺄까요?', you: '나',
    rules: '급여 규칙', period: '급여 기간', ptype: '주기', biweekly: '2주마다', semimonthly: '한 달에 두 번 (1–15일, 16–말일)', monthly: '한 달에 한 번', anchor: '2주 기간 시작일', rounding: '시간 반올림', roundNone: '안 함', roundMin: '{n}분 단위',
    brk: '휴게시간', brkOn: '무급 휴게시간 빼기', brkAfter: '이 시간보다 길게 일하면', brkMin: '빼는 시간 (분)',
    ot: '초과근무', otOn: '초과근무 계산하기', d1: '하루 기준 1 (시간)', d2: '하루 기준 2 (시간)', w: '주 기준 (시간, 일–토)', mult: '배율',
    statH: '공휴일', statOn: '공휴일 근무 배율 적용', statX: '공휴일 근무 배율', statAvgOn: '공휴일 수당(평균 일당) 계산', statAvgD: 'BC 기준: 입사 30일 이상이고 공휴일 전 30일 중 15일 이상 일한 직원에게 평균 일당을 줘요.',
    vacH: '휴가수당', vacOn: '매 급여에 휴가수당 포함', vacPct: '비율 (%)', vacD: 'BC 기본 4%, 5년 이상 근무자는 6%예요.',
    tipsH: '팁', tipsOn: '팁 나누기', tipM: '나누는 방법',
    square: 'Square 연결', squareD: '연결하면 팁과 매출을 Square에서 자동으로 가져와요.', connect: 'Square 연결하기', soon: '준비 중',
    account: '내 계정', changePw: '비밀번호 바꾸기',
    setChanged: '바꿨어요. 급여에 바로 반영돼요.', saveFail: '저장하지 못했어요: {m}', netFail: '서버에 연결하지 못했어요. 인터넷을 확인하세요.', ownerOnly: '사장 계정만 바꿀 수 있어요.',
  },
  en: {
    sub: 'Staff & Payroll', all: 'All', langley: 'Langley', burnaby: 'Burnaby', both: 'Both',
    tabToday: 'Today', tabCards: 'Timesheet', tabPay: 'Payroll', tabStaff: 'Staff', tabSet: 'Settings',
    dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    notConfigured: 'The server address is not set yet. Check config.js.',
    email: 'Email', password: 'Password', signIn: 'Sign in', signUp: 'Create account', haveAccount: 'I already have an account', needAccount: 'I need an account',
    forgot: 'Forgot password', sendReset: 'Send reset email', resetSent: 'Reset email sent. Open the link in it.',
    newPw: 'New password', setPw: 'Change password', pwChanged: 'Password changed.', pwShort: 'Use at least 8 characters.',
    firstRun: 'First-time setup. The first account created becomes the owner (admin) account.',
    checkMail: 'We sent a confirmation email. Open its link, then sign in here.',
    authFail: 'Email or password is not right. First time here? Tap [I need an account] below to create one.', backToClock: '← Back to clock',
    noAccess: 'This account is not on the team yet', noAccessD: 'Ask the owner to invite {e} in Settings → Team, then try again.', retry: 'Check again', signOut: 'Sign out',
    deviceRevoked: 'This device was removed as a clock-in device. Sign in as admin to register it again.',
    tapName: 'Tap your name', clockIn: 'Clock in', clockOut: 'Clock out', working: 'Working', since: 'Working since {t}', off: 'Off',
    enterPin: 'Enter your 4-digit PIN', wrongPin: 'Wrong PIN', pinLocked: 'Too many wrong PINs. Locked for 5 minutes.',
    doneIn: 'Clocked in', doneOut: 'Clocked out', doneHours: '{h} h today', already: 'Already clocked in (since {t})', outNoIn: 'No clock-in found, so only the clock-out was saved. The owner will check it.',
    savedOffline: 'No internet — saved on this iPad. It uploads automatically when back online.', tapToClose: 'Tap to close',
    onNow: 'Working now', nobody: 'Nobody is clocked in.', todayLog: 'Today', noToday: 'No records yet today.',
    noStaffK: 'No staff at this location yet', noStaffKD: 'Sign in as admin → Staff to add them.',
    online: 'Online', offline: 'Offline', queued: '{n} waiting to upload', admin: 'Admin', cancel: 'Cancel', del: 'Delete',
    kioskBanner: 'This iPad is the store clock. The admin view closes itself after 5 minutes idle.', toKiosk: 'Back to clock',
    guideTitle: 'Getting started', g1: 'Add staff', g1d: 'Name, wage and an optional PIN.', g2: 'Register the store iPad', g2d: 'On the iPad: sign in → Settings → "Use this device as the store clock".', g3: 'Start clocking', g3d: 'Staff tap their name to clock in/out. Pay is calculated for you.',
    statSoon: 'Upcoming stat holidays', statInDays: 'in {n} days', statTodayTag: 'today', statElig: 'Gets stat pay', statSoFar: '{n} days so far · needs 15', statNo: 'Not eligible · {n} days', statNew: 'Employed under 30 days', statCheck: 'Needs records from before the app — check manually ({n} days recorded)',
    statRule: 'BC: staff employed 30+ days who worked 15 of the 30 days before the holiday get an average day’s pay. Hours worked on the holiday are paid 1.5× on top. The app counts the days from the timesheet and adds it to payroll.',
    missingAlert: '{n} record(s) need review (missing clock-out etc.).', fix: 'Fix now',
    devicesNow: 'Store devices', lastSeen: 'last seen {t}', never: 'never connected', ago: '{n} min ago', agoH: '{n} h ago', agoD: '{n} d ago', justNow: 'just now',
    cardsTitle: 'Timesheet', allStaff: 'All staff', onlyIssues: 'Needs review only', addRecord: 'Add record', cardsHint: 'Tap a record to correct it. Who changed what, when and why is kept.',
    noCards: 'No time records', noCardsD: 'Records appear here when staff clock in on the store iPad.', loadMore: 'Load older records',
    missingOut: 'No clock-out', missingIn: 'No clock-in', edited: 'Edited', manualTag: 'Manual', staff: 'Staff', loc: 'Location', date: 'Date', inT: 'In', outT: 'Out',
    note: 'Note', notePh: 'e.g. stayed 30 min for closing', reason: 'Reason', reasonPh: 'e.g. forgot to clock out', save: 'Save', needTime: 'Enter a date and a clock-in or clock-out time.', saved: 'Saved', deleted: 'Deleted', delQ: 'Delete this record? (history is kept)',
    history: 'History', kioskActor: 'Store iPad', manual: 'Manual edit', none: 'none', loading: 'Loading…',
    actCreate: 'added', actUpdate: 'edited', actDelete: 'deleted', actRestore: 'restored', actKiosk: 'clocked',
    payTitle: 'Payroll', prev: 'Previous period', next: 'Next period', thisPeriod: 'Current period',
    totalHours: 'Total hours', totalPay: 'Total to pay (gross)', toCheck: 'Needs review', checkNone: 'Nothing missing', checkSome: '{n} record(s) need review — not counted yet',
    reg: 'Regular', ot15: 'OT 1.5×', ot2: 'OT 2×', stat: 'Stat worked', stat2: 'Stat over 12h', tips: 'Tips', wage: 'Wage', gross: 'Pay', vac: 'Vacation pay', statAvg: 'Stat pay',
    statYes: '{d} stat pay {a}', statUnknown: '{d} stat pay: needs records from before the app — check manually', noWage: 'No wage', wageChanged: 'Wage changed in period',
    noPay: 'No hours in this period.', tapDetail: 'Tap a person to see each day.',
    tipsTitle: 'Tips this period', tipsHint: 'These come in automatically once Square is connected. For now, enter each location’s total and it is split {m}.', byHours: 'by hours worked', equally: 'equally',
    copy: 'Copy for Excel', copied: 'Copied. Paste into Excel to get a table.', selected: 'The table below is selected. Copy it and paste into Excel.',
    csvSum: 'Download summary CSV', csvDetail: 'Download detail CSV (for accountant)',
    ruleNote: 'BC rules: over {d1} h a day at {x1}×, over {d2} h at {x2}×, over {w} h a week (Sun–Sat) at {wx}×, stat holiday work at {sx}×. Amounts are before tax, CPP and EI. Change rules in Settings.',
    staffTitle: 'Staff', staffCount: '{n}', addStaff: 'Add staff', name: 'Name', role: 'Role', rolePh: 'e.g. Barista', wageL: 'Hourly wage ($)', startDate: 'Start date (optional)',
    pin: 'Clock-in PIN', pinSet: 'set', pinNone: 'none', pinNew: 'New 4-digit PIN', pinClear: 'Remove PIN', pinHint: 'With a PIN nobody can clock in for someone else. Without one, tapping the name is enough.', pinBad: 'A PIN is 4 digits.',
    active: 'Currently employed', inactive: 'Inactive', activeHint: 'Turn off to hide from the clock screen. Records are kept.', needName: 'Enter a name.', added: '{n} added', last7: '{h} h in the last 7 days', perHour: '/h',
    wageHist: 'Wage history', wageNew: 'Change wage', wageFrom: 'Effective from', wageAdd: 'Save change', wageNeed: 'Enter a wage and a start date.',
    setTitle: 'Settings', thisDevice: 'This device', isKiosk: 'This device is registered as the "{n}" clock.', openKiosk: 'Open the clock',
    regDevice: 'Use this device as the store clock', regDeviceD: 'Do this on the store iPad. It signs out and shows only the clock screen. Staff never see wages or pay.',
    devName: 'Device name', devNamePh: 'e.g. Langley counter iPad', register: 'Register', registered: 'Registered. Switching to the clock screen.',
    devices: 'Registered clock devices', noDevices: 'None yet.', revoke: 'Remove', revokeQ: 'Remove this device? It will no longer be able to clock anyone in.', revoked: 'Removed', revokedTag: 'removed',
    team: 'Team', teamD: 'Invited people create an account at this address and are in right away. Managers handle timesheets and staff but cannot see wages, payroll or settings.',
    owner: 'Owner', manager: 'Manager', invite: 'Invite', invited: 'invited', invitedOk: 'Invited. Send them this address: {u}', remove: 'Remove', removeQ: 'Remove from the team?', you: 'you',
    rules: 'Pay rules', period: 'Pay period', ptype: 'Frequency', biweekly: 'Every 2 weeks', semimonthly: 'Twice a month (1–15, 16–end)', monthly: 'Monthly', anchor: 'Bi-weekly start date', rounding: 'Round time', roundNone: 'No rounding', roundMin: 'To {n} min',
    brk: 'Breaks', brkOn: 'Deduct an unpaid break', brkAfter: 'For shifts longer than (h)', brkMin: 'Minutes deducted',
    ot: 'Overtime', otOn: 'Calculate overtime', d1: 'Daily limit 1 (h)', d2: 'Daily limit 2 (h)', w: 'Weekly limit (h, Sun–Sat)', mult: 'Rate',
    statH: 'Stat holidays', statOn: 'Apply stat holiday rate', statX: 'Stat holiday rate', statAvgOn: 'Calculate stat pay (average day’s pay)', statAvgD: 'BC: staff employed 30+ days who worked 15 of the 30 days before the holiday get an average day’s pay.',
    vacH: 'Vacation pay', vacOn: 'Pay vacation pay on each cheque', vacPct: 'Percent', vacD: 'BC: 4%, or 6% after 5 years.',
    tipsH: 'Tips', tipsOn: 'Split tips', tipM: 'Split',
    square: 'Square', squareD: 'Once connected, tips and sales come in from Square automatically.', connect: 'Connect Square', soon: 'Coming soon',
    account: 'My account', changePw: 'Change password',
    setChanged: 'Updated. Payroll reflects it right away.', saveFail: 'Could not save: {m}', netFail: 'Could not reach the server. Check the internet.', ownerOnly: 'Only the owner can change this.',
  },
};

// ---------- app state ----------
const prefs = Object.assign({ lang: 'ko', loc: 'all' }, store.get(K_PREFS, {}));
const savePrefs = () => store.set(K_PREFS, prefs);
const t = (k, vars) => { let s = TXT[prefs.lang][k] ?? TXT.ko[k] ?? k; if (vars) for (const [a, b] of Object.entries(vars)) s = s.replaceAll(`{${a}}`, b); return s; };
const fmtDay = (s) => {
  const [, m, d] = s.split('-').map(Number), w = t('dow')[P.dow(s)];
  return prefs.lang === 'ko' ? `${m}/${d} (${w})` : `${w} ${new Date(Date.UTC(2000, m - 1, 1)).toLocaleString('en-CA', { month: 'short', timeZone: 'UTC' })} ${d}`;
};
const ago = (ts) => {
  if (!ts) return t('never');
  const m = Math.round((Date.now() - Date.parse(ts)) / 60000);
  return m < 1 ? t('justNow') : m < 60 ? t('ago', { n: m }) : m < 1440 ? t('agoH', { n: Math.round(m / 60) }) : t('agoD', { n: Math.round(m / 1440) });
};

const cfg = window.RICOTTA_CONFIG || {};
const sb = cfg.url && window.supabase ? window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

const app = { mode: 'boot', authView: 'in', authMsg: '', recovering: false, hasOwner: true, email: '' };
const ui = { tab: 'today', off: 0, open: {}, editId: null, newPunch: null, staffEdit: null, cardStaff: 'all', onlyIssues: false, csv: '', confirm: null, logs: {}, regOpen: false, busy: false };
let D = null; // admin data
const h = location.hash.slice(1);
if (['today', 'cards', 'pay', 'staff', 'settings'].includes(h)) ui.tab = h;

function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { el.hidden = true; }, 3200); }
const fail = (error) => toast(/fetch|network/i.test(error?.message || '') ? t('netFail') : t('saveFail', { m: error?.message || '?' }));

const I = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
  pay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/></svg>',
  staff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
};
const av = (name) => `<span class="av">${esc(initial(name))}</span>`;
const langSeg = () => `<div class="seg lang" role="group" aria-label="Language"><button data-act="lang" data-id="ko" aria-pressed="${prefs.lang === 'ko'}">한</button><button data-act="lang" data-id="en" aria-pressed="${prefs.lang === 'en'}">EN</button></div>`;

// =====================================================================
// KIOSK (store iPad)
// =====================================================================
const K = { data: store.get(K_CACHE, null), online: true, pick: null, pin: '', shake: false, done: null, lastTouch: Date.now() };
const deviceToken = () => store.get(K_DEVICE, null);
const queue = () => store.get(K_QUEUE, []);

async function kioskLoad() {
  await kioskFlush();
  const { data, error } = await sb.rpc('kiosk_state', { p_token: deviceToken() });
  if (error) {
    if (/bad_device/.test(error.message)) { store.del(K_DEVICE); store.del(K_CACHE); app.authMsg = t('deviceRevoked'); app.mode = 'login'; render(); return; }
    K.online = false;
  } else {
    K.online = true; K.data = data; store.set(K_CACHE, data);
  }
  if (app.mode === 'kiosk') renderKiosk();
}

async function kioskFlush() {
  let q = queue();
  while (q.length) {
    const item = q[0];
    const { error } = await sb.rpc('kiosk_punch', { p_token: deviceToken(), p_staff: item.staff, p_action: item.action, p_pin: item.pin, p_at: item.at, p_client: item.id });
    if (error && /fetch|network|Failed/i.test(error.message)) { K.online = false; return; }
    q = queue().filter((x) => x.id !== item.id);
    store.set(K_QUEUE, q);
  }
}

async function kioskSubmit(action) {
  const s = K.data.staff.find((x) => x.id === K.pick);
  if (!s) return;
  const pin = s.has_pin ? K.pin : null;
  const id = uuid();
  const { data, error } = await sb.rpc('kiosk_punch', { p_token: deviceToken(), p_staff: s.id, p_action: action, p_pin: pin, p_at: null, p_client: id });
  K.pin = '';
  if (error) {
    if (/pin_locked/.test(error.message)) { K.pick = null; renderKiosk(); toast(t('pinLocked')); return; }
    if (/bad_device/.test(error.message)) { kioskLoad(); return; }
    if (/fetch|network|Failed/i.test(error.message)) {
      // Offline: keep the tap on this iPad and show it as done.
      const at = new Date().toISOString();
      store.set(K_QUEUE, [...queue(), { id, staff: s.id, action, pin, at }]);
      K.online = false;
      s.open = action === 'in' ? at : null;
      K.data.today.push({ staff_id: s.id, name: s.name, in: action === 'in' ? at : null, out: action === 'out' ? at : null });
      store.set(K_CACHE, K.data);
      K.done = { name: s.name, action, time: hmOf(Date.now()), note: t('savedOffline') };
      K.pick = null; renderKiosk(); doneTimer();
      return;
    }
    toast(t('saveFail', { m: error.message })); K.pick = null; renderKiosk(); return;
  }
  if (data.result === 'bad_pin') { K.shake = true; renderKiosk(); K.shake = false; toast(t('wrongPin')); return; }
  const inMs = data.in ? Date.parse(data.in) : null, outMs = data.out ? Date.parse(data.out) : null;
  if (data.result === 'already_in') K.done = { name: s.name, action: 'in', time: hmOf(inMs), note: t('already', { t: hmOf(inMs) }) };
  else if (data.result === 'out_without_in') K.done = { name: s.name, action: 'out', time: hmOf(outMs), note: t('outNoIn') };
  else if (data.result === 'out') K.done = { name: s.name, action: 'out', time: hmOf(outMs), note: t('doneHours', { h: hrs((outMs - inMs) / 3600e3) }) };
  else K.done = { name: s.name, action: 'in', time: hmOf(inMs), note: '' };
  K.pick = null; renderKiosk(); doneTimer();
  kioskLoad();
}
function doneTimer() { clearTimeout(doneTimer.h); doneTimer.h = setTimeout(() => { K.done = null; renderKiosk(); }, 3500); }

function renderKiosk() {
  document.documentElement.lang = prefs.lang;
  const d = K.data;
  const now = new Date();
  if (!d) { $('#root').innerHTML = `<div class="auth"><p class="muted">${t('loading')}</p></div>`; return; }
  const pick = d.staff.find((s) => s.id === K.pick);
  const q = queue().length;
  const working = d.staff.filter((s) => s.open);
  $('#root').innerHTML = `
    <header class="k-top">
      <div class="brand"><b>Cafe Ricotta</b><span class="where">${esc(t(d.device.loc))}</span></div>
      <span class="k-clock" id="kClock">${hmOf(now.getTime())}</span>
      ${langSeg()}
    </header>
    <main class="k-main">
      ${d.staff.length ? `
      <div class="head"><h2>${t('tapName')}</h2></div>
      <div class="k-names">${d.staff.map((s) => `<button class="k-name ${s.open ? 'in' : ''}" data-act="kPick" data-id="${s.id}" aria-pressed="${K.pick === s.id}">${av(s.name)}<span>${esc(s.name)}</span><span class="st">${s.open ? t('since', { t: hmOf(Date.parse(s.open)) }) : t('off')}</span></button>`).join('')}</div>
` : `<div class="card empty"><h3>${t('noStaffK')}</h3><p class="note">${t('noStaffKD')}</p></div>`}
      <div class="card">
        <div class="day-h"><span>${t('onNow')}</span><span class="num">${working.length}</span></div>
        ${working.length ? working.map((s) => `<div class="row"><div class="who">${av(s.name)}<span>${esc(s.name)}</span></div><div class="num">${hmOf(Date.parse(s.open))}</div></div>`).join('') : `<div class="row"><span class="muted">${t('nobody')}</span></div>`}
        <div class="day-h"><span>${t('todayLog')}</span><span class="num">${d.today.length}</span></div>
        ${d.today.length ? d.today.map((p) => `<div class="row"><div class="who">${av(p.name)}<span>${esc(p.name)}</span></div><div class="num">${p.in ? hmOf(Date.parse(p.in)) : '?'} – ${p.out ? hmOf(Date.parse(p.out)) : ''}</div></div>`).join('') : `<div class="row"><span class="muted">${t('noToday')}</span></div>`}
      </div>
      <div class="k-foot">
        <span class="dot-status ${K.online ? '' : 'off'}"><i></i>${K.online ? t('online') : t('offline')}${q ? ' · ' + t('queued', { n: q }) : ''}</span>
        <button class="btn ghost" data-act="kAdmin">${t('admin')}</button>
      </div>
    </main>
    ${pick ? `<div class="k-sheet" data-act="kCancel"><div class="card k-panel" role="dialog" aria-modal="true" aria-label="${esc(pick.name)}">
      <h3>${esc(pick.name)} · ${pick.open ? t('clockOut') : t('clockIn')}</h3>
      <p class="muted">${pick.open ? t('since', { t: hmOf(Date.parse(pick.open)) }) : t('off')}</p>
      ${pick.has_pin ? `<p>${t('enterPin')}</p>
        <div class="dots ${K.shake ? 'shake' : ''}" aria-label="PIN">${[0, 1, 2, 3].map((i) => `<i class="${i < K.pin.length ? 'on' : ''}"></i>`).join('')}</div>
        <div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'x', '0', '<'].map((k) => k === 'x' ? `<button data-act="kCancel" style="font-family:var(--sans);font-size:16px">${t('cancel')}</button>` : k === '<' ? `<button data-act="kKey" data-id="<" aria-label="${t('del')}">⌫</button>` : `<button data-act="kKey" data-id="${k}">${k}</button>`).join('')}</div>`
      : `<button class="btn primary k-action" data-act="kGo">${pick.open ? t('clockOut') : t('clockIn')}</button>
         <button class="btn ghost" data-act="kCancel">${t('cancel')}</button>`}
    </div></div>` : ''}
    ${K.done ? `<div class="done" data-act="kDone"><div><div class="big">${esc(K.done.name)}<br>${K.done.action === 'in' ? t('doneIn') : t('doneOut')}</div><div class="t">${K.done.time}</div>${K.done.note ? `<p>${esc(K.done.note)}</p>` : ''}<p>${t('tapToClose')}</p></div></div>` : ''}`;
}

// =====================================================================
// LOGIN
// =====================================================================
function renderLogin() {
  document.documentElement.lang = prefs.lang;
  const v = app.authView;
  $('#root').innerHTML = `<div class="auth">
    <div style="display:flex;justify-content:flex-end">${langSeg()}</div>
    <div class="brand"><b>Cafe Ricotta</b><span>${t('sub')}</span></div>
    ${app.authMsg ? `<div class="banner">${esc(app.authMsg)}</div>` : ''}
    ${!app.hasOwner && v !== 'reset' ? `<div class="banner">${t('firstRun')}</div>` : ''}
    ${app.recovering ? `<form class="card pad" data-form="newpw"><label class="f">${t('newPw')}<input type="password" name="pw" autocomplete="new-password" minlength="8" required></label><button class="btn primary big">${t('setPw')}</button></form>` : `
    <form class="card pad" data-form="${v}">
      <label class="f">${t('email')}<input type="email" name="email" autocomplete="email" required value="${esc(app.email)}"></label>
      ${v !== 'reset' ? `<label class="f">${t('password')}<input type="password" name="pw" autocomplete="${v === 'up' ? 'new-password' : 'current-password'}" ${v === 'up' ? 'minlength="8"' : ''} required></label>` : ''}
      <button class="btn primary big" ${ui.busy ? 'disabled' : ''}>${v === 'in' ? t('signIn') : v === 'up' ? t('signUp') : t('sendReset')}</button>
      <div class="inline-actions" style="justify-content:space-between">
        ${v === 'in' ? `<button type="button" class="link" data-act="authView" data-id="up">${t('needAccount')}</button><button type="button" class="link muted" data-act="authView" data-id="reset">${t('forgot')}</button>`
          : `<button type="button" class="link" data-act="authView" data-id="in">${t('haveAccount')}</button>`}
      </div>
    </form>`}
    ${deviceToken() ? `<button class="btn" data-act="toKiosk">${t('backToClock')}</button>` : ''}
  </div>`;
}

async function onAuthSubmit(form) {
  const f = new FormData(form), email = String(f.get('email') || '').trim().toLowerCase(), pw = String(f.get('pw') || '');
  app.email = email; ui.busy = true; app.authMsg = '';
  const redirectTo = location.origin + location.pathname;
  try {
    if (form.dataset.form === 'in') {
      const { error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error) { app.authMsg = /confirm/i.test(error.message) ? t('checkMail') : t('authFail'); return; }
      await enterAdmin();
    } else if (form.dataset.form === 'up') {
      if (pw.length < 8) { app.authMsg = t('pwShort'); return; }
      const { data, error } = await sb.auth.signUp({ email, password: pw, options: { emailRedirectTo: redirectTo } });
      if (error) { app.authMsg = error.message; return; }
      if (!data.session) { app.authMsg = t('checkMail'); app.authView = 'in'; return; }
      await enterAdmin();
    } else if (form.dataset.form === 'reset') {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      app.authMsg = error ? error.message : t('resetSent');
      app.authView = 'in';
    } else if (form.dataset.form === 'newpw') {
      if (pw.length < 8) { app.authMsg = t('pwShort'); return; }
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) { app.authMsg = error.message; return; }
      app.recovering = false; toast(t('pwChanged'));
      await enterAdmin();
    }
  } catch (e) { app.authMsg = t('netFail'); }
  finally { ui.busy = false; if (app.mode === 'login') renderLogin(); }
}

// =====================================================================
// ADMIN
// =====================================================================
const isOwner = () => D?.role === 'owner';
const normPunch = (r) => ({ id: r.id, staffId: r.staff_id, loc: r.loc, inMs: r.clock_in ? Date.parse(r.clock_in) : null, outMs: r.clock_out ? Date.parse(r.clock_out) : null, source: r.source, note: r.note || '', updated: r.updated_at, created: r.created_at });
const staffById = (id) => D.staff.find((s) => s.id === id);
const inLoc = (loc) => prefs.loc === 'all' || loc === prefs.loc || loc === 'both';
const statName = (st) => (prefs.lang === 'ko' ? st.ko : st.en);

async function enterAdmin() {
  const { data: role, error } = await sb.rpc('join_team');
  if (error) { fail(error); app.mode = 'login'; render(); return; }
  const { data: { user } } = await sb.auth.getUser();
  if (!role) { app.mode = 'noaccess'; app.email = user?.email || ''; render(); return; }
  D = { role, me: user, staff: [], wages: [], punches: [], loadedFrom: null, devices: [], members: [], invites: [], tips: {}, settings: null };
  app.mode = 'admin';
  K.lastTouch = Date.now();
  await loadAll();
}

async function fetchAllPunches(from) {
  const out = [];
  for (let page = 0; ; page++) {
    const { data, error } = await sb.from('punches').select('*').eq('deleted', false).gte('ts', iso(P.fromLocal(from, '00:00'))).order('ts').range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

async function loadAll(minFrom) {
  try {
    const [st, se, dv, mb] = await Promise.all([
      sb.from('staff').select('*').order('sort').order('name'),
      sb.from('settings').select('data').eq('id', 1).single(),
      sb.from('devices').select('id,name,loc,revoked,last_seen,created_at').order('created_at'),
      sb.from('members').select('*').order('created_at'),
    ]);
    for (const r of [st, se, dv, mb]) if (r.error) throw r.error;
    D.staff = st.data; D.settings = se.data.data; D.devices = dv.data; D.members = mb.data;
    if (isOwner()) {
      const [wg, iv, tp] = await Promise.all([
        sb.from('staff_wages').select('*').order('effective'),
        sb.from('invites').select('*').order('created_at'),
        sb.from('tips').select('*'),
      ]);
      for (const r of [wg, iv, tp]) if (r.error) throw r.error;
      D.wages = wg.data.map((w) => ({ id: w.id, staffId: w.staff_id, wage: +w.wage, effective: w.effective }));
      D.invites = iv.data;
      D.tips = Object.fromEntries(tp.data.map((x) => [`${x.period_start}|${x.loc}`, +x.amount]));
    }
    const want = P.addDays(P.periodRange(D.settings, Math.min(ui.off, -1), today()).start, -45);
    const from = [minFrom, want, D.loadedFrom].filter(Boolean).sort()[0];
    D.punches = (await fetchAllPunches(from)).map(normPunch);
    D.loadedFrom = from;
  } catch (e) { fail(e); }
  render();
}

function guide() {
  const hasStaff = D.staff.length > 0, hasDev = D.devices.some((d) => !d.revoked);
  return `<div class="cap">${t('guideTitle')}</div><div class="steps">
    <div class="card step click ${hasStaff ? 'done' : ''}" data-act="guideStaff" role="button" tabindex="0"><span class="n">1</span><b>${t('g1')}</b><span class="note">${t('g1d')}</span></div>
    <div class="card step click ${hasDev ? 'done' : ''}" data-act="guideDevice" role="button" tabindex="0"><span class="n">2</span><b>${t('g2')}</b><span class="note">${t('g2d')}</span></div>
    <div class="card step"><span class="n">3</span><b>${t('g3')}</b><span class="note">${t('g3d')}</span></div></div>`;
}

const visiblePunches = () => D.punches.filter((p) => inLoc(p.loc));
const missingList = () => visiblePunches().filter((p) => P.isMissing(p, Date.now()));

// Upcoming BC stat holidays (next 21 days) with who qualifies for the average day's pay.
function statCard() {
  const st = D.settings, td = today();
  if (!st.stat.on) return '';
  const y = +td.slice(0, 4);
  const soon = P.bcStats(y).concat(P.bcStats(y + 1)).filter((h) => h.date >= td && P.daysBetween(td, h.date) <= 21);
  if (!soon.length) return '';
  const staff = D.staff.filter((s) => s.active && inLoc(s.loc));
  if (!staff.length) return '';
  return soon.map((h) => {
    const left = P.daysBetween(td, h.date);
    const rows = staff.map((s) => {
      const days = P.classify(D.punches.filter((p) => p.staffId === s.id), st);
      const r = P.statAverage({ staff: { id: s.id, startDate: s.start_date }, days, wages: D.wages, settings: st, date: h.date });
      const n = r.daysWorked || 0;
      const reachable = n + Math.max(0, left) >= 15;
      let label, strong = false;
      if (r.status === 'yes') { label = t('statElig') + (isOwner() && st.stat.avgDay ? ' · ' + money(r.amount) : ''); strong = true; }
      else if (r.status === 'unknown') label = t('statCheck', { n });
      else if (s.start_date && P.daysBetween(s.start_date, h.date) < 30) label = t('statNew');
      else if (left > 0 && reachable) label = t('statSoFar', { n });
      else label = t('statNo', { n });
      return `<div class="row"><div class="who">${av(s.name)}<span>${esc(s.name)}</span></div><div class="note" style="${strong ? 'color:var(--ink);font-weight:600' : ''}">${label}</div></div>`;
    }).join('');
    return `<div class="card"><div class="day-h"><span>${t('statSoon')} · ${fmtDay(h.date)} ${esc(statName(h))}</span><span class="pill on">${left ? t('statInDays', { n: left }) : t('statTodayTag')}</span></div>${rows}<div class="row"><span class="note">${t('statRule')}</span></div></div>`;
  }).join('');
}

function viewToday() {
  const now = Date.now(), td = today();
  const open = visiblePunches().filter((p) => p.inMs && !p.outMs && now - p.inMs <= P.OPEN_LIMIT_MS);
  const todays = visiblePunches().filter((p) => P.punchDay(p) === td);
  const miss = missingList().length;
  const devs = D.devices.filter((d) => !d.revoked && inLoc(d.loc));
  const setupDone = D.staff.length && D.devices.some((d) => !d.revoked) && D.punches.length;
  return `
    ${miss ? `<div class="banner"><span><span class="pill alert">!</span> ${t('missingAlert', { n: miss })}</span><button class="btn" data-act="goIssues">${t('fix')}</button></div>` : ''}
    <div class="card">
      <div class="day-h"><span>${t('onNow')}</span><span class="num">${open.length}</span></div>
      ${open.length ? open.map((p) => { const s = staffById(p.staffId); return `<div class="row"><div><div class="who">${av(s?.name)}<span>${esc(s?.name)}</span></div><div class="sub"><span>${t(p.loc)}</span></div></div><div class="num">${hmOf(p.inMs)} · ${hrs((now - p.inMs) / 3600e3)}h</div></div>`; }).join('') : `<div class="row"><span class="muted">${t('nobody')}</span></div>`}
      <div class="day-h"><span>${t('todayLog')} · ${fmtDay(td)}</span><span class="num">${todays.length}</span></div>
      ${todays.length ? todays.map((p) => { const s = staffById(p.staffId); return `<div class="row"><div><div class="who">${av(s?.name)}<span>${esc(s?.name)}</span></div><div class="sub"><span>${t(p.loc)}</span></div></div><div class="num">${p.inMs ? hmOf(p.inMs) : '?'} – ${p.outMs ? hmOf(p.outMs) : ''}</div></div>`; }).join('') : `<div class="row"><span class="muted">${t('noToday')}</span></div>`}
    </div>
    ${statCard()}
    ${devs.length ? `<div class="card"><div class="day-h"><span>${t('devicesNow')}</span></div>${devs.map((d) => `<div class="row"><div><b>${esc(d.name)}</b><div class="sub"><span>${t(d.loc)}</span></div></div><div class="note">${t('lastSeen', { t: ago(d.last_seen) })}</div></div>`).join('')}</div>` : ''}
    ${setupDone ? '' : guide()}`;
}

function editForm(p, isNew) {
  const date = isNew ? today() : P.punchDay(p);
  const staffOpts = D.staff.filter((s) => s.active || s.id === p.staffId);
  const log = ui.logs[p.id];
  const who = (l) => (l.actor ? (D.members.find((m) => m.user_id === l.actor)?.email || '?') : t('kioskActor'));
  const fmtVal = (k, v) => v == null || v === '' ? t('none') : (k === 'clock_in' || k === 'clock_out') ? `${fmtDay(P.local(Date.parse(v)).ymd)} ${hmOf(Date.parse(v))}` : k === 'staff_id' ? (staffById(v)?.name || '?') : k === 'loc' ? t(v) : String(v);
  const actName = { create: 'actCreate', update: 'actUpdate', delete: 'actDelete', restore: 'actRestore', kiosk: 'actKiosk' };
  return `<div class="editbox" data-punch="${isNew ? 'new' : p.id}">
    <div class="form">
      <label class="f">${t('staff')}<select id="e-staff">${staffOpts.map((s) => `<option value="${s.id}" ${p.staffId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="f">${t('loc')}<select id="e-loc">${P.LOCS.map((l) => `<option value="${l}" ${p.loc === l ? 'selected' : ''}>${t(l)}</option>`).join('')}</select></label>
      <label class="f">${t('date')}<input id="e-date" type="date" value="${date}"></label>
      <label class="f">${t('inT')}<input id="e-in" type="time" value="${p.inMs ? hmOf(p.inMs) : ''}"></label>
      <label class="f">${t('outT')}<input id="e-out" type="time" value="${p.outMs ? hmOf(p.outMs) : ''}"></label>
      <label class="f">${t('reason')}<input id="e-reason" placeholder="${t('reasonPh')}"></label>
    </div>
    <label class="f">${t('note')}<input id="e-note" maxlength="300" value="${esc(p.note || '')}" placeholder="${t('notePh')}"></label>
    ${ui.confirm === 'delPunch' ? `<div class="confirm">${t('delQ')}<button class="btn primary" data-act="delPunch">${t('del')}</button><button class="btn ghost" data-act="noConfirm">${t('cancel')}</button></div>`
      : `<div class="inline-actions"><button class="btn primary" data-act="saveEdit">${t('save')}</button><button class="btn ghost" data-act="cancelEdit">${t('cancel')}</button>${isNew ? '' : `<button class="btn ghost" data-act="askDelPunch">${t('del')}</button>`}</div>`}
    ${isNew ? '' : `<div class="log"><b style="color:var(--ink)">${t('history')}</b>${!log ? t('loading') : log.map((l) => {
      const changes = l.old ? Object.keys(l.new || {}).filter((k) => JSON.stringify(l.old[k]) !== JSON.stringify(l.new[k]) && k !== 'deleted').map((k) => `${k === 'clock_in' ? t('inT') : k === 'clock_out' ? t('outT') : k === 'staff_id' ? t('staff') : k === 'note' ? t('note') : t('loc')} ${esc(fmtVal(k, l.old[k]))} → ${esc(fmtVal(k, l.new[k]))}`).join(', ') : '';
      return `<span>${fmtDay(P.local(Date.parse(l.at)).ymd)} ${hmOf(Date.parse(l.at))} · ${esc(who(l))} · ${t(actName[l.action] || 'actUpdate')}${changes ? ' · ' + changes : ''}${l.reason ? ` · “${esc(l.reason)}”` : ''}</span>`;
    }).join('')}</div>`}
  </div>`;
}

function viewCards() {
  const td = today(), now = Date.now();
  const staffOpts = D.staff.filter((s) => inLoc(s.loc));
  const list = visiblePunches()
    .filter((p) => ui.cardStaff === 'all' || p.staffId === ui.cardStaff)
    .filter((p) => !ui.onlyIssues || P.isMissing(p, now))
    .sort((a, b) => (b.inMs ?? b.outMs) - (a.inMs ?? a.outMs));
  const byDay = {};
  list.forEach((p) => (byDay[P.punchDay(p)] ||= []).push(p));
  return `
    <div class="head"><h2>${t('cardsTitle')}</h2>
      <div class="inline-actions">
        <select class="sel" id="cardStaff" aria-label="${t('staff')}"><option value="all">${t('allStaff')}</option>${staffOpts.map((s) => `<option value="${s.id}" ${ui.cardStaff === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" id="onlyIssues" ${ui.onlyIssues ? 'checked' : ''}> ${t('onlyIssues')}</label>
        <button class="btn primary" data-act="newPunch" ${D.staff.length ? '' : 'disabled'}>${t('addRecord')}</button>
      </div></div>
    ${ui.newPunch ? `<div class="card">${editForm(ui.newPunch, true)}</div>` : ''}
    ${list.length ? `<p class="note">${t('cardsHint')}</p><div class="card">${Object.entries(byDay).map(([d, ps]) => `
      <div class="day-h"><span>${fmtDay(d)} ${D.settings.stat.on && P.statOn(d) ? `<span class="pill on">${esc(statName(P.statOn(d)))}</span>` : ''}</span><span class="num muted">${hrs(ps.reduce((a, p) => a + P.shiftHours(p, D.settings), 0))}h</span></div>
      ${ps.map((p) => {
        const s = staffById(p.staffId), missOut = p.inMs && !p.outMs && P.isMissing(p, now), missIn = !p.inMs, live = p.inMs && !p.outMs && !missOut;
        const edited = p.source === 'manual' || (p.updated && p.created && Date.parse(p.updated) - Date.parse(p.created) > 1000 && p.source !== 'kiosk');
        return `<div class="row click" data-act="edit" data-id="${p.id}"><div><div class="who">${av(s?.name)}<span>${esc(s?.name)}</span></div>
          <div class="sub"><span class="num">${p.inMs ? hmOf(p.inMs) : '?'} – ${p.outMs ? hmOf(p.outMs) : '?'}</span><span>${t(p.loc)}</span>${missOut ? `<span class="pill alert">${t('missingOut')}</span>` : ''}${missIn ? `<span class="pill alert">${t('missingIn')}</span>` : ''}${live ? `<span class="pill on">${t('working')}</span>` : ''}${p.source === 'manual' ? `<span class="pill">${t('manualTag')}</span>` : edited ? `<span class="pill">${t('edited')}</span>` : ''}</div>${p.note ? `<div class="sub" style="color:var(--ink)">${t('note')}: ${esc(p.note)}</div>` : ''}</div>
          <div class="num">${p.inMs && p.outMs ? hrs(P.shiftHours(p, D.settings)) + 'h' : '—'}</div></div>${ui.editId === p.id ? editForm(p, false) : ''}`;
      }).join('')}`).join('')}</div>`
    : `<div class="card empty"><h3>${t('noCards')}</h3><p class="note">${t('noCardsD')}</p></div>`}
    <div><button class="btn" data-act="loadMore">${t('loadMore')}</button> <span class="note">${fmtDay(D.loadedFrom)} ~</span></div>`;
}

function currentPayroll() {
  const range = P.periodRange(D.settings, ui.off, today());
  return P.payroll({ staff: D.staff, wages: D.wages, punches: D.punches, settings: D.settings, tips: D.tips, range, nowMs: Date.now(), locFilter: prefs.loc });
}

function viewPay() {
  if (!isOwner()) return `<div class="card empty"><p class="muted">${t('ownerOnly')}</p></div>`;
  const { range, rows } = currentPayroll(), st = D.settings, o = st.ot;
  const tot = (k) => rows.reduce((a, r) => a + r[k], 0);
  const flags = rows.reduce((a, r) => a + r.missing + r.statAvg.filter((x) => x.status === 'unknown').length + (r.noWage ? 1 : 0), 0);
  const locs = prefs.loc === 'all' ? P.LOCS : [prefs.loc];
  return `
    <div class="head"><h2>${t('payTitle')}</h2>
      <div class="inline-actions"><button class="btn" data-act="per" data-d="-1" aria-label="${t('prev')}">‹</button><b class="num" style="font-size:14px">${fmtDay(range.start)} – ${fmtDay(range.end)}</b><button class="btn" data-act="per" data-d="1" aria-label="${t('next')}" ${ui.off >= 0 ? 'disabled' : ''}>›</button>${ui.off === 0 ? `<span class="pill on">${t('thisPeriod')}</span>` : ''}</div></div>
    <div class="sum">
      <div class="card kpi"><div class="cap">${t('totalHours')}</div><div class="v">${hrs(tot('hours'))}</div></div>
      <div class="card kpi"><div class="cap">${t('totalPay')}</div><div class="v">${money(tot('total'))}</div></div>
      <div class="card kpi"><div class="cap">${t('toCheck')}</div><div class="v">${flags}</div><div class="note">${flags ? t('checkSome', { n: flags }) : t('checkNone')}</div></div>
    </div>
    ${st.tipsOn ? `<div class="card pad set-group"><b>${t('tipsTitle')}</b>
      <div class="tipbox">${locs.map((l) => `<label class="f">${t(l)} ($)<input type="number" inputmode="decimal" min="0" step="0.01" data-tip="${range.start}|${l}" value="${D.tips[`${range.start}|${l}`] ?? ''}" placeholder="0.00" style="width:150px"></label>`).join('')}</div>
      <p class="note">${t('tipsHint', { m: st.tipMethod === 'equal' ? t('equally') : t('byHours') })}</p></div>` : ''}
    ${rows.length ? `<div class="card">${rows.map((r) => `
      <div class="pay-card" data-act="toggle" data-id="${r.staff.id}">
        <div class="pay-top"><div class="who">${av(r.staff.name)}<span>${esc(r.staff.name)}</span>${r.missing ? `<span class="pill alert">${t('toCheck')} ${r.missing}</span>` : ''}${r.noWage ? `<span class="pill alert">${t('noWage')}</span>` : ''}</div><div class="amt">${money(r.total)}</div></div>
        <div class="break"><span>${t('reg')} <b>${hrs(r.reg)}</b></span>${r.x15 ? `<span>${t('ot15')} <b>${hrs(r.x15)}</b></span>` : ''}${r.x2 ? `<span>${t('ot2')} <b>${hrs(r.x2)}</b></span>` : ''}${r.stat ? `<span>${t('stat')} <b>${hrs(r.stat)}</b></span>` : ''}${r.stat2 ? `<span>${t('stat2')} <b>${hrs(r.stat2)}</b></span>` : ''}
          <span>${t('wage')} <b>${r.wagesUsed.length > 1 ? r.wagesUsed.map(money).join(' → ') : money(r.wage)}</b></span><span>${t('gross')} <b>${money(r.gross)}</b></span>${r.statAvgTotal ? `<span>${t('statAvg')} <b>${money(r.statAvgTotal)}</b></span>` : ''}${st.vac?.on ? `<span>${t('vac')} <b>${money(r.vac)}</b></span>` : ''}${st.tipsOn ? `<span>${t('tips')} <b>${money(r.tips)}</b></span>` : ''}</div>
        ${r.statAvg.filter((x) => x.status === 'unknown').map((x) => `<div class="note"><span class="pill alert">!</span> ${t('statUnknown', { d: fmtDay(x.date) })}</div>`).join('')}
        ${ui.open[r.staff.id] ? `<div class="days">${r.days.map((c) => `<div><span>${fmtDay(c.date)}</span><span class="num muted">${c.punches.map((p) => hmOf(p.inMs) + '–' + hmOf(p.outMs)).join(', ')}${P.statOn(c.date) && st.stat.on ? ' · ' + esc(statName(P.statOn(c.date))) : ''}</span><span class="num">${hrs(c.hours)}h</span></div>`).join('')}
          ${r.statAvg.filter((x) => x.status === 'yes').map((x) => `<div><span>${fmtDay(x.date)}</span><span class="muted">${t('statAvg')}</span><span class="num">${money(x.amount)}</span></div>`).join('')}</div>` : ''}
      </div>`).join('')}</div>
      <div class="inline-actions"><button class="btn primary" data-act="csv">${t('copy')}</button><button class="btn" data-act="dlSum">${t('csvSum')}</button><button class="btn" data-act="dlDetail">${t('csvDetail')}</button></div>
      <p class="note">${t('tapDetail')}</p>
      ${ui.csv ? `<textarea class="out" id="csvOut" readonly aria-label="CSV">${esc(ui.csv)}</textarea>` : ''}`
    : `<div class="card empty"><p class="muted">${t('noPay')}</p></div>`}
    <p class="note">${t('ruleNote', { d1: o.d1, x1: o.d1x, d2: o.d2, x2: o.d2x, w: o.w, wx: o.wx, sx: st.stat.x })}</p>`;
}

function summaryTable() {
  const { range, rows } = currentPayroll();
  const head = [t('staff'), t('loc'), t('reg'), t('ot15'), t('ot2'), t('stat'), t('stat2'), t('totalHours'), t('wage'), t('gross'), t('statAvg'), t('vac'), t('tips'), t('totalPay')];
  const body = rows.map((r) => [r.staff.name, t(r.staff.loc), hrs(r.reg), hrs(r.x15), hrs(r.x2), hrs(r.stat), hrs(r.stat2), hrs(r.hours), r.wagesUsed.map((w) => w.toFixed(2)).join(' / ') || r.wage.toFixed(2), r.gross.toFixed(2), r.statAvgTotal.toFixed(2), r.vac.toFixed(2), r.tips.toFixed(2), r.total.toFixed(2)]);
  return { range, lines: [head, ...body] };
}
function detailTable() {
  const { range, rows } = currentPayroll();
  const head = [t('staff'), t('date'), t('loc'), t('inT'), t('outT'), t('totalHours'), t('wage'), t('note')];
  const body = [];
  for (const r of rows) for (const c of r.days) for (const p of c.punches) body.push([r.staff.name, c.date, t(p.loc), hmOf(p.inMs), hmOf(p.outMs), hrs(P.shiftHours(p, D.settings)), P.wageOn(D.wages, r.staff.id, c.date).toFixed(2), p.note || '']);
  return { range, lines: [head, ...body] };
}
function download(name, lines) {
  const csv = '﻿' + lines.map((l) => l.map((v) => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function viewStaff() {
  const list = D.staff.filter((s) => inLoc(s.loc)), f = ui.staffEdit, owner = isOwner();
  const since = P.addDays(today(), -7);
  const form = (s) => {
    const hist = D.wages.filter((w) => w.staffId === s.id).sort((a, b) => b.effective.localeCompare(a.effective));
    return `<div class="editbox">
    <div class="form">
      <label class="f">${t('name')}<input id="st-name" value="${esc(s.name)}" maxlength="60"></label>
      <label class="f">${t('role')}<input id="st-role" value="${esc(s.role)}" placeholder="${t('rolePh')}"></label>
      <label class="f">${t('loc')}<select id="st-loc">${['langley', 'burnaby', 'both'].map((l) => `<option value="${l}" ${s.loc === l ? 'selected' : ''}>${t(l)}</option>`).join('')}</select></label>
      <label class="f">${t('startDate')}<input id="st-start" type="date" value="${s.start_date || ''}"></label>
      ${s.isNew && owner ? `<label class="f">${t('wageL')}<input id="st-wage" type="number" inputmode="decimal" step="0.05" min="0" value="18.25"></label>` : ''}
      <label class="f">${t('pin')} · ${s.has_pin ? t('pinSet') : t('pinNone')}<input id="st-pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="${t('pinNew')}"></label>
    </div>
    <p class="note">${t('pinHint')}${s.has_pin ? ` <button class="link" data-act="clearPin">${t('pinClear')}</button>` : ''}</p>
    <label class="check"><input type="checkbox" id="st-active" ${s.active ? 'checked' : ''}> ${t('active')}</label>
    <p class="note">${t('activeHint')}</p>
    <div class="inline-actions"><button class="btn primary" data-act="saveStaff">${t('save')}</button><button class="btn ghost" data-act="cancelStaff">${t('cancel')}</button></div>
    ${!s.isNew && owner ? `<div class="set-group" style="border-top:1px dashed var(--line);padding-top:12px">
      <b>${t('wageHist')}</b>
      <div class="log">${hist.length ? hist.map((w) => `<span class="num">${w.effective} ~ · ${money(w.wage)}</span>`).join('') : `<span>${t('noWage')}</span>`}</div>
      <div class="form"><label class="f">${t('wageNew')} ($)<input id="w-amt" type="number" inputmode="decimal" step="0.05" min="0"></label><label class="f">${t('wageFrom')}<input id="w-from" type="date" value="${today()}"></label></div>
      <div><button class="btn" data-act="addWage">${t('wageAdd')}</button></div></div>` : ''}
  </div>`;
  };
  return `
    <div class="head"><h2>${t('staffTitle')} <span class="muted num" style="font-size:16px">${t('staffCount', { n: list.length })}</span></h2><button class="btn primary" data-act="newStaff">${t('addStaff')}</button></div>
    ${f && f.isNew ? `<div class="card">${form(f)}</div>` : ''}
    ${list.length ? `<div class="card">${list.map((s) => {
      const h7 = D.punches.filter((p) => p.staffId === s.id && P.punchDay(p) >= since).reduce((a, p) => a + P.shiftHours(p, D.settings), 0);
      const w = owner ? P.wageOn(D.wages, s.id, today()) : null;
      return `<div class="row click" data-act="editStaff" data-id="${s.id}" style="${s.active ? '' : 'opacity:.55'}">
        <div><div class="who">${av(s.name)}<span>${esc(s.name)}</span>${s.active ? '' : `<span class="pill">${t('inactive')}</span>`}</div>
        <div class="sub">${s.role ? `<span>${esc(s.role)}</span>` : ''}<span>${t(s.loc)}</span>${owner ? `<span class="num">${w ? money(w) + t('perHour') : t('noWage')}</span>` : ''}<span>PIN ${s.has_pin ? t('pinSet') : t('pinNone')}</span></div></div>
        <div class="note">${t('last7', { h: hrs(h7) })}</div></div>${f && f.id === s.id ? form(f) : ''}`;
    }).join('')}</div>` : (f ? '' : `<div class="card empty"><h3>${t('noStaffK')}</h3><p class="note">${t('g1d')}</p></div>`)}`;
}

function viewSettings() {
  const st = D.settings, owner = isOwner(), tok = deviceToken();
  const dis = owner ? '' : 'disabled';
  const num = (id, v, step) => `<input id="${id}" type="number" inputmode="decimal" step="${step}" min="0" value="${v}" ${dis}>`;
  const appUrl = location.origin + location.pathname;
  return `
    <div class="head"><h2>${t('setTitle')}</h2></div>
    <div class="card pad set-group"><h3>${t('thisDevice')}</h3>
      ${tok ? `<p>${t('isKiosk', { n: esc(K.data?.device?.name || '') })}</p><div><button class="btn primary" data-act="toKiosk">${t('openKiosk')}</button></div>`
        : ui.regOpen ? `<div class="form"><label class="f">${t('devName')}<input id="d-name" placeholder="${t('devNamePh')}"></label>
            <label class="f">${t('loc')}<select id="d-loc">${P.LOCS.map((l) => `<option value="${l}" ${prefs.loc === l ? 'selected' : ''}>${t(l)}</option>`).join('')}</select></label></div>
            <div class="inline-actions"><button class="btn primary" data-act="regDevice">${t('register')}</button><button class="btn ghost" data-act="regClose">${t('cancel')}</button></div>`
        : `<p class="note">${t('regDeviceD')}</p><div><button class="btn" data-act="regOpen">${t('regDevice')}</button></div>`}
    </div>
    <div class="card"><div class="day-h"><span>${t('devices')}</span></div>
      ${D.devices.length ? D.devices.map((d) => `<div class="row"><div><b>${esc(d.name)}</b><div class="sub"><span>${t(d.loc)}</span>${d.revoked ? `<span class="pill">${t('revokedTag')}</span>` : `<span>${t('lastSeen', { t: ago(d.last_seen) })}</span>`}</div></div>
        <div>${d.revoked ? '' : ui.confirm === 'rev:' + d.id ? `<div class="confirm">${t('revokeQ')}<button class="btn primary" data-act="revoke" data-id="${d.id}">${t('revoke')}</button><button class="btn ghost" data-act="noConfirm">${t('cancel')}</button></div>` : `<button class="btn" data-act="askRevoke" data-id="${d.id}">${t('revoke')}</button>`}</div></div>`).join('') : `<div class="row"><span class="muted">${t('noDevices')}</span></div>`}
    </div>
    ${owner ? `<div class="card pad set-group"><h3>${t('team')}</h3><p class="note">${t('teamD')}</p>
      <div class="card">${D.members.map((m) => `<div class="row"><div><b>${esc(m.email)}</b> ${m.user_id === D.me.id ? `<span class="pill">${t('you')}</span>` : ''}<div class="sub"><span>${t(m.role)}</span></div></div>
        <div>${m.user_id === D.me.id ? '' : ui.confirm === 'mem:' + m.user_id ? `<div class="confirm">${t('removeQ')}<button class="btn primary" data-act="removeMember" data-id="${m.user_id}">${t('remove')}</button><button class="btn ghost" data-act="noConfirm">${t('cancel')}</button></div>` : `<button class="btn" data-act="askRemove" data-id="${m.user_id}">${t('remove')}</button>`}</div></div>`).join('')}
        ${D.invites.map((i) => `<div class="row"><div><b>${esc(i.email)}</b><div class="sub"><span>${t(i.role)}</span><span class="pill">${t('invited')}</span></div></div><button class="btn" data-act="delInvite" data-id="${esc(i.email)}">${t('remove')}</button></div>`).join('')}</div>
      <div class="form"><label class="f">${t('email')}<input id="inv-email" type="email" autocomplete="off"></label><label class="f">${t('role')}<select id="inv-role"><option value="manager">${t('manager')}</option><option value="owner">${t('owner')}</option></select></label></div>
      <div><button class="btn" data-act="invite">${t('invite')}</button> <span class="note">${esc(appUrl)}</span></div></div>` : ''}
    <div class="card pad set-group"><h3>${t('rules')}</h3>${owner ? '' : `<p class="note">${t('ownerOnly')}</p>`}
      <div class="form">
        <label class="f">${t('ptype')}<select id="s-ptype" ${dis}>${['biweekly', 'semimonthly', 'monthly'].map((k) => `<option value="${k}" ${st.period.type === k ? 'selected' : ''}>${t(k)}</option>`).join('')}</select></label>
        ${st.period.type === 'biweekly' ? `<label class="f">${t('anchor')}<input id="s-anchor" type="date" value="${st.period.anchor}" ${dis}></label>` : ''}
        <label class="f">${t('rounding')}<select id="s-round" ${dis}>${[0, 5, 15].map((r) => `<option value="${r}" ${+st.rounding === r ? 'selected' : ''}>${r ? t('roundMin', { n: r }) : t('roundNone')}</option>`).join('')}</select></label></div></div>
    <div class="card pad set-group"><h3>${t('brk')}</h3><label class="check"><input type="checkbox" id="s-brk" ${st.brk.on ? 'checked' : ''} ${dis}> ${t('brkOn')}</label>
      <div class="form"><label class="f">${t('brkAfter')}${num('s-brk-after', st.brk.after, 0.5)}</label><label class="f">${t('brkMin')}${num('s-brk-min', st.brk.minutes, 5)}</label></div></div>
    <div class="card pad set-group"><h3>${t('ot')}</h3><label class="check"><input type="checkbox" id="s-ot" ${st.ot.on ? 'checked' : ''} ${dis}> ${t('otOn')}</label>
      <div class="form"><label class="f">${t('d1')}${num('s-d1', st.ot.d1, 0.5)}</label><label class="f">${t('mult')}${num('s-d1x', st.ot.d1x, 0.25)}</label>
      <label class="f">${t('d2')}${num('s-d2', st.ot.d2, 0.5)}</label><label class="f">${t('mult')}${num('s-d2x', st.ot.d2x, 0.25)}</label>
      <label class="f">${t('w')}${num('s-w', st.ot.w, 1)}</label><label class="f">${t('mult')}${num('s-wx', st.ot.wx, 0.25)}</label></div></div>
    <div class="card pad set-group"><h3>${t('statH')}</h3><label class="check"><input type="checkbox" id="s-stat" ${st.stat.on ? 'checked' : ''} ${dis}> ${t('statOn')}</label>
      <div class="form"><label class="f">${t('statX')}${num('s-statx', st.stat.x, 0.25)}</label></div>
      <label class="check"><input type="checkbox" id="s-statavg" ${st.stat.avgDay ? 'checked' : ''} ${dis}> ${t('statAvgOn')}</label><p class="note">${t('statAvgD')}</p>
      <div class="sub">${P.bcStats(+today().slice(0, 4)).concat(P.bcStats(+today().slice(0, 4) + 1)).filter((d) => d.date >= today()).slice(0, 8).map((d) => `<span class="pill">${d.date.slice(5).replace('-', '/')} ${esc(statName(d))}</span>`).join('')}</div></div>
    <div class="card pad set-group"><h3>${t('vacH')}</h3><label class="check"><input type="checkbox" id="s-vac" ${st.vac?.on ? 'checked' : ''} ${dis}> ${t('vacOn')}</label>
      <div class="form"><label class="f">${t('vacPct')}${num('s-vacpct', st.vac?.pct ?? 4, 1)}</label></div><p class="note">${t('vacD')}</p></div>
    <div class="card pad set-group"><h3>${t('tipsH')}</h3><label class="check"><input type="checkbox" id="s-tips" ${st.tipsOn ? 'checked' : ''} ${dis}> ${t('tipsOn')}</label>
      <div class="form"><label class="f">${t('tipM')}<select id="s-tipm" ${dis}><option value="hours" ${st.tipMethod === 'hours' ? 'selected' : ''}>${t('byHours')}</option><option value="equal" ${st.tipMethod === 'equal' ? 'selected' : ''}>${t('equally')}</option></select></label></div></div>
    <div class="card pad set-group"><h3>${t('square')}</h3><p class="note">${t('squareD')}</p><div class="inline-actions"><button class="btn primary" disabled>${t('connect')}</button><span class="pill">${t('soon')}</span></div></div>
    <div class="card pad set-group"><h3>${t('account')}</h3><p><b>${esc(D.me.email)}</b> · ${t(D.role)}</p>
      <div class="form"><label class="f">${t('newPw')}<input id="acc-pw" type="password" autocomplete="new-password" minlength="8"></label></div>
      <div class="inline-actions"><button class="btn" data-act="changePw">${t('changePw')}</button><button class="btn" data-act="signOut">${t('signOut')}</button></div></div>`;
}

const TABS = [['today', 'tabToday'], ['cards', 'tabCards'], ['pay', 'tabPay'], ['staff', 'tabStaff'], ['settings', 'tabSet']];
function renderAdmin() {
  document.documentElement.lang = prefs.lang;
  const tabs = TABS.filter(([id]) => id !== 'pay' || isOwner());
  if (!tabs.some(([id]) => id === ui.tab)) ui.tab = 'today';
  const view = D.settings ? { today: viewToday, cards: viewCards, pay: viewPay, staff: viewStaff, settings: viewSettings }[ui.tab]() : `<p class="muted">${t('loading')}</p>`;
  const y = window.scrollY;
  $('#root').innerHTML = `
    <header class="top"><div class="top-in">
      <div class="brand"><b>Cafe Ricotta</b><span>${t('sub')}</span></div>
      <div class="seg" role="group" aria-label="${t('loc')}">${['all', ...P.LOCS].map((l) => `<button data-act="loc" data-id="${l}" aria-pressed="${prefs.loc === l}">${t(l)}</button>`).join('')}</div>
      ${langSeg()}
      <button class="btn" data-act="signOut">${t('signOut')}</button>
    </div>
    <nav class="tabs" role="tablist">${tabs.map(([id, k]) => `<button role="tab" data-act="goTab" data-tab="${id}" aria-selected="${ui.tab === id}">${I[id]}<span>${t(k)}</span></button>`).join('')}</nav></header>
    <main class="wrap"><section class="view">
      ${deviceToken() ? `<div class="banner"><span>${t('kioskBanner')}</span><button class="btn primary" data-act="toKiosk">${t('toKiosk')}</button></div>` : ''}
      ${view}</section></main>`;
  window.scrollTo(0, y);
}

function renderNoAccess() {
  $('#root').innerHTML = `<div class="auth"><div class="brand"><b>Cafe Ricotta</b><span>${t('sub')}</span></div>
    <div class="card empty"><h3>${t('noAccess')}</h3><p class="note">${t('noAccessD', { e: esc(app.email) })}</p>
    <div class="inline-actions"><button class="btn primary" data-act="retryJoin">${t('retry')}</button><button class="btn" data-act="signOut">${t('signOut')}</button></div></div></div>`;
}

function render() {
  if (!sb) { $('#root').innerHTML = `<div class="auth"><div class="brand"><b>Cafe Ricotta</b></div><div class="banner">${t('notConfigured')}</div></div>`; return; }
  ({ boot: () => { $('#root').innerHTML = `<div class="auth"><p class="muted">${t('loading')}</p></div>`; }, kiosk: renderKiosk, login: renderLogin, noaccess: renderNoAccess, admin: renderAdmin })[app.mode]();
}

async function toKiosk() {
  await sb.auth.signOut();
  D = null; app.mode = 'kiosk'; K.pick = null; K.pin = '';
  renderKiosk(); kioskLoad();
}

// ---------- events ----------
document.addEventListener('click', async (e) => {
  K.lastTouch = Date.now();
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  const go = (tab) => { ui.tab = tab; ui.csv = ''; ui.confirm = null; history.replaceState(null, '', '#' + tab); render(); window.scrollTo(0, 0); };

  // shared
  if (act === 'lang') { prefs.lang = id; savePrefs(); render(); return; }
  if (act === 'toKiosk') { toKiosk(); return; }
  if (act === 'signOut') { await sb.auth.signOut(); D = null; if (deviceToken()) toKiosk(); else { app.mode = 'login'; app.authView = 'in'; render(); } return; }
  if (act === 'authView') { app.authView = id; app.authMsg = ''; renderLogin(); return; }
  if (act === 'retryJoin') { enterAdmin(); return; }

  // kiosk
  if (act === 'kPick') { K.pick = K.pick === id ? null : id; K.pin = ''; renderKiosk(); return; }
  if (act === 'kCancel') { if (el.classList.contains('k-sheet') && e.target !== el) return; K.pick = null; K.pin = ''; renderKiosk(); return; }
  if (act === 'kGo') { const s = K.data.staff.find((x) => x.id === K.pick); el.disabled = true; kioskSubmit(s?.open ? 'out' : 'in'); return; }
  if (act === 'kKey') {
    if (id === '<') K.pin = K.pin.slice(0, -1); else if (K.pin.length < 4) K.pin += id;
    renderKiosk();
    if (K.pin.length === 4) { const s = K.data.staff.find((x) => x.id === K.pick); kioskSubmit(s?.open ? 'out' : 'in'); }
    return;
  }
  if (act === 'kDone') { K.done = null; renderKiosk(); return; }
  if (act === 'kAdmin') {
    const { data: { session } } = await sb.auth.getSession();
    if (session) enterAdmin(); else { app.mode = 'login'; app.authView = 'in'; app.authMsg = ''; renderLogin(); }
    return;
  }

  if (app.mode !== 'admin' || !D) return;
  if (act === 'loc') { prefs.loc = id; savePrefs(); ui.cardStaff = 'all'; render(); }
  else if (act === 'goTab') go(el.dataset.tab);
  else if (act === 'guideStaff') { ui.staffEdit = { id: null, name: '', role: '', loc: prefs.loc === 'all' ? 'langley' : prefs.loc, start_date: null, active: true, has_pin: false, isNew: true }; go('staff'); }
  else if (act === 'guideDevice') { ui.regOpen = true; go('settings'); }
  else if (act === 'goIssues') { ui.onlyIssues = true; ui.cardStaff = 'all'; go('cards'); }
  else if (act === 'noConfirm') { ui.confirm = null; render(); }
  // timesheet
  else if (act === 'edit') {
    if (e.target.closest('input,select,button,label,.editbox')) return;
    ui.editId = ui.editId === id ? null : id; ui.newPunch = null; ui.confirm = null; render();
    if (ui.editId && !ui.logs[id]) {
      const { data } = await sb.from('punch_log').select('*').eq('punch_id', id).order('id');
      ui.logs[id] = data || []; render();
    }
  }
  else if (act === 'newPunch') {
    const sid = ui.cardStaff !== 'all' ? ui.cardStaff : (D.staff.find((s) => s.active && inLoc(s.loc)) || D.staff[0]).id;
    const s = staffById(sid);
    ui.newPunch = { staffId: sid, loc: s.loc === 'both' ? (prefs.loc === 'all' ? 'langley' : prefs.loc) : s.loc, inMs: null, outMs: null };
    ui.editId = null; render();
  }
  else if (act === 'cancelEdit') { ui.newPunch = null; ui.editId = null; ui.confirm = null; render(); }
  else if (act === 'askDelPunch') { ui.confirm = 'delPunch'; render(); }
  else if (act === 'delPunch') {
    const reason = $('#e-reason')?.value.trim() || t('manual');
    const { error } = await sb.from('punches').update({ deleted: true, edit_reason: reason }).eq('id', ui.editId);
    if (error) return fail(error);
    delete ui.logs[ui.editId]; ui.editId = null; ui.confirm = null; toast(t('deleted')); loadAll();
  }
  else if (act === 'saveEdit') {
    const d = $('#e-date').value, i = $('#e-in').value, o = $('#e-out').value;
    if (!d || (!i && !o)) { toast(t('needTime')); return; }
    const inMs = i ? P.fromLocal(d, i) : null;
    let outMs = o ? P.fromLocal(d, o) : null;
    if (inMs != null && outMs != null && outMs <= inMs) outMs = P.fromLocal(P.addDays(d, 1), o);
    const row = { staff_id: $('#e-staff').value, loc: $('#e-loc').value, note: $('#e-note').value.trim(), clock_in: iso(inMs), clock_out: iso(outMs), edit_reason: $('#e-reason').value.trim() || t('manual') };
    const isNew = !!ui.newPunch;
    const { error } = isNew ? await sb.from('punches').insert({ ...row, source: 'manual' }) : await sb.from('punches').update(row).eq('id', ui.editId);
    if (error) return fail(error);
    if (!isNew) delete ui.logs[ui.editId];
    ui.newPunch = null; ui.editId = null; toast(t('saved')); loadAll();
  }
  else if (act === 'loadMore') { loadAll(P.addDays(D.loadedFrom, -60)); }
  // payroll
  else if (act === 'per') {
    ui.off = Math.min(0, ui.off + +el.dataset.d); ui.open = {}; ui.csv = '';
    const need = P.addDays(P.periodRange(D.settings, ui.off, today()).start, -45);
    if (need < D.loadedFrom) loadAll(need); else render();
  }
  else if (act === 'toggle') { ui.open[id] = !ui.open[id]; render(); }
  else if (act === 'csv') {
    const { range, lines } = summaryTable();
    ui.csv = `${range.start} ~ ${range.end}\n` + lines.map((l) => l.join('\t')).join('\n');
    const fallback = () => { render(); const ta = $('#csvOut'); if (ta) { ta.focus(); ta.select(); } toast(t('selected')); };
    try { await navigator.clipboard.writeText(ui.csv); render(); toast(t('copied')); } catch { fallback(); }
  }
  else if (act === 'dlSum') { const { range, lines } = summaryTable(); download(`ricotta-payroll-${range.start}_${range.end}.csv`, lines); }
  else if (act === 'dlDetail') { const { range, lines } = detailTable(); download(`ricotta-shifts-${range.start}_${range.end}.csv`, lines); }
  // staff
  else if (act === 'newStaff') { ui.staffEdit = { id: null, name: '', role: '', loc: prefs.loc === 'all' ? 'langley' : prefs.loc, start_date: null, active: true, has_pin: false, isNew: true }; render(); }
  else if (act === 'editStaff') { if (e.target.closest('input,select,button,label,.editbox')) return; ui.staffEdit = ui.staffEdit?.id === id ? null : { ...staffById(id) }; render(); }
  else if (act === 'cancelStaff') { ui.staffEdit = null; render(); }
  else if (act === 'clearPin') {
    const { error } = await sb.rpc('set_staff_pin', { p_staff: ui.staffEdit.id, p_pin: null });
    if (error) return fail(error);
    ui.staffEdit.has_pin = false; toast(t('saved')); loadAll();
  }
  else if (act === 'saveStaff') {
    const f = ui.staffEdit, name = $('#st-name').value.trim(), pin = $('#st-pin').value.trim();
    if (!name) { toast(t('needName')); return; }
    if (pin && !/^\d{4}$/.test(pin)) { toast(t('pinBad')); return; }
    const row = { name, role: $('#st-role').value.trim(), loc: $('#st-loc').value, start_date: $('#st-start').value || null, active: $('#st-active').checked };
    let sid = f.id;
    if (f.isNew) {
      const { data, error } = await sb.from('staff').insert(row).select().single();
      if (error) return fail(error);
      sid = data.id;
      const wage = +($('#st-wage')?.value || 0);
      if (isOwner() && wage > 0) {
        const { error: we } = await sb.from('staff_wages').insert({ staff_id: sid, wage, effective: row.start_date || today() });
        if (we) fail(we);
      }
    } else {
      const { error } = await sb.from('staff').update(row).eq('id', sid);
      if (error) return fail(error);
    }
    if (pin) { const { error } = await sb.rpc('set_staff_pin', { p_staff: sid, p_pin: pin }); if (error) fail(error); }
    toast(f.isNew ? t('added', { n: name }) : t('saved'));
    ui.staffEdit = null; loadAll();
  }
  else if (act === 'addWage') {
    const amt = +$('#w-amt').value, from = $('#w-from').value;
    if (!(amt > 0) || !from) { toast(t('wageNeed')); return; }
    const { error } = await sb.from('staff_wages').upsert({ staff_id: ui.staffEdit.id, wage: amt, effective: from }, { onConflict: 'staff_id,effective' });
    if (error) return fail(error);
    toast(t('saved')); loadAll();
  }
  // settings
  else if (act === 'regOpen') { ui.regOpen = true; render(); }
  else if (act === 'regClose') { ui.regOpen = false; render(); }
  else if (act === 'regDevice') {
    const loc = $('#d-loc').value, name = $('#d-name').value.trim() || `${t(loc)} iPad`;
    const { data, error } = await sb.rpc('register_device', { p_name: name, p_loc: loc });
    if (error) return fail(error);
    store.set(K_DEVICE, data); store.del(K_CACHE); store.del(K_QUEUE);
    ui.regOpen = false; toast(t('registered'));
    setTimeout(toKiosk, 900);
  }
  else if (act === 'askRevoke') { ui.confirm = 'rev:' + id; render(); }
  else if (act === 'revoke') {
    const { error } = await sb.from('devices').update({ revoked: true }).eq('id', id);
    if (error) return fail(error);
    ui.confirm = null; toast(t('revoked')); loadAll();
  }
  else if (act === 'invite') {
    const email = $('#inv-email').value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return;
    const { error } = await sb.from('invites').upsert({ email, role: $('#inv-role').value, created_by: D.me.id });
    if (error) return fail(error);
    toast(t('invitedOk', { u: location.origin + location.pathname })); loadAll();
  }
  else if (act === 'delInvite') { const { error } = await sb.from('invites').delete().eq('email', id); if (error) return fail(error); loadAll(); }
  else if (act === 'askRemove') { ui.confirm = 'mem:' + id; render(); }
  else if (act === 'removeMember') { const { error } = await sb.from('members').delete().eq('user_id', id); if (error) return fail(error); ui.confirm = null; loadAll(); }
  else if (act === 'changePw') {
    const pw = $('#acc-pw').value;
    if (pw.length < 8) { toast(t('pwShort')); return; }
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return fail(error);
    $('#acc-pw').value = ''; toast(t('pwChanged'));
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  onAuthSubmit(form);
});

document.addEventListener('change', async (e) => {
  const el = e.target;
  if (app.mode !== 'admin' || !D) return;
  if (el.id === 'cardStaff') { ui.cardStaff = el.value; render(); return; }
  if (el.id === 'onlyIssues') { ui.onlyIssues = el.checked; render(); return; }
  if (el.dataset.tip) {
    const [period_start, loc] = el.dataset.tip.split('|'), v = el.value;
    const { error } = v === '' ? await sb.from('tips').delete().match({ period_start, loc }) : await sb.from('tips').upsert({ period_start, loc, amount: Math.max(0, +v), updated_by: D.me.id });
    if (error) return fail(error);
    if (v === '') delete D.tips[el.dataset.tip]; else D.tips[el.dataset.tip] = Math.max(0, +v);
    render(); return;
  }
  const st = structuredClone(D.settings);
  const map = {
    's-ptype': () => { st.period.type = el.value; ui.off = 0; }, 's-anchor': () => { if (el.value) st.period.anchor = el.value; }, 's-round': () => { st.rounding = +el.value; },
    's-brk': () => { st.brk.on = el.checked; }, 's-brk-after': () => { st.brk.after = +el.value; }, 's-brk-min': () => { st.brk.minutes = +el.value; },
    's-ot': () => { st.ot.on = el.checked; }, 's-d1': () => { st.ot.d1 = +el.value; }, 's-d1x': () => { st.ot.d1x = +el.value; }, 's-d2': () => { st.ot.d2 = +el.value; }, 's-d2x': () => { st.ot.d2x = +el.value; }, 's-w': () => { st.ot.w = +el.value; }, 's-wx': () => { st.ot.wx = +el.value; },
    's-stat': () => { st.stat.on = el.checked; }, 's-statx': () => { st.stat.x = +el.value; }, 's-statavg': () => { st.stat.avgDay = el.checked; },
    's-vac': () => { st.vac = { ...(st.vac || { pct: 4 }), on: el.checked }; }, 's-vacpct': () => { st.vac = { ...(st.vac || { on: false }), pct: +el.value }; },
    's-tips': () => { st.tipsOn = el.checked; }, 's-tipm': () => { st.tipMethod = el.value; },
  };
  if (!map[el.id]) return;
  map[el.id]();
  const { data, error } = await sb.from('settings').update({ data: st, updated_at: new Date().toISOString() }).eq('id', 1).select();
  if (error || !data?.length) { fail(error || { message: t('ownerOnly') }); render(); return; }
  D.settings = st; render(); toast(t('setChanged'));
});

// ---------- timers ----------
setInterval(() => {
  const c = $('#kClock');
  if (c) c.textContent = hmOf(Date.now());
}, 10000);
setInterval(() => {
  if (app.mode === 'kiosk') {
    if (K.pick && Date.now() - K.lastTouch > 30000) { K.pick = null; K.pin = ''; renderKiosk(); }
    if (!K.pick && !K.done) kioskLoad();
  }
  // On the store iPad, never leave the admin view open.
  if (app.mode === 'admin' && deviceToken() && Date.now() - K.lastTouch > 5 * 60000) toKiosk();
}, 30000);
setInterval(() => { if (app.mode === 'admin' && D && ui.tab === 'today' && document.visibilityState === 'visible' && !ui.editId) loadAll(); }, 60000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (app.mode === 'kiosk') kioskLoad();
  else if (app.mode === 'admin' && D && !ui.editId && !ui.staffEdit && !ui.newPunch) loadAll();
});
window.addEventListener('online', () => { if (app.mode === 'kiosk') kioskLoad(); });
document.addEventListener('keydown', () => { K.lastTouch = Date.now(); });

// ---------- boot ----------
async function boot() {
  render();
  if (!sb) return;
  sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') { app.recovering = true; app.mode = 'login'; render(); }
  });
  const { data: { session } } = await sb.auth.getSession();
  if (app.recovering) return;
  if (session) { await enterAdmin(); return; }
  if (deviceToken()) { app.mode = 'kiosk'; renderKiosk(); kioskLoad(); return; }
  const { data: owner } = await sb.rpc('has_owner');
  app.hasOwner = owner !== false;
  if (!app.hasOwner) app.authView = 'up';
  app.mode = 'login'; render();
}
boot();

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
