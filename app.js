// Cafe Ricotta staff & payroll — one page, three faces:
//   kiosk  : the store iPad (device token, no login) — staff tap name (+PIN) to clock in/out
//   login  : owner / managers sign in
//   admin  : today, timesheet, payroll (owner), staff, settings
import * as P from './payroll.js';
import { payrollWorkbook } from './payroll-export.mjs';
import { safeItems, validItems, createKioskQueue, createDurableMutations, createOnlineGate, writeStored, hasUnconfirmedPayrollWrite } from './reliability.mjs';

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
    staffHint: '직원은 여기서 로그인하지 않아요. 출퇴근은 매장 아이패드에서 이름과 PIN으로 하세요. 이 화면은 사장·매니저용이에요.',
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
    tabOrders: '케이크 예약', kClockTab: '출퇴근', kOrdersTab: '케이크 예약',
    oTitle: '케이크 예약', oAdd: '예약 추가', oUpcoming: '다가오는 예약', oPast: '지난 예약', oNone: '예약이 없어요', oNoneD: '[예약 추가]를 눌러 케이크 예약을 넣으세요.',
    oToday: '오늘', oTomorrow: '내일', oInDays: '{n}일 후', oAgo: '{n}일 전', oNoTime: '시간 미정',
    oDate: '픽업 날짜', oTime: '픽업 시간', oCust: '손님 이름', oPhone: '전화번호', oCakes: '케이크', oQty: '개수', oAddLine: '+ 케이크 추가', oOther: '기타 (메모에 적기)', oNote: '메모', oNotePh: '예: 케이크 위 문구 “Happy Birthday 지민”, 초 3개',
    oPaid: '결제', unpaid: '미결제', deposit: '일부 선결제', paid: '결제 완료', oTaken: '받은 직원', oLoc: '픽업 지점', oPhoto: '영수증 사진', oPhotoAdd: '사진 찍기 / 고르기', oPhotoView: '사진 보기', oPhotoDel: '사진 빼기', oPhotoNew: '새 사진',
    open: '예약됨', made: '제작 완료', picked: '픽업 완료', cancelled: '취소됨', oMade: '제작 완료', oPicked: '픽업 완료', oCancel: '예약 취소', oCancelQ: '이 예약을 취소할까요?', oReopen: '되돌리기',
    oNeed: '픽업 날짜와 케이크를 넣어주세요.', oSaved: '예약을 저장했어요.', oSoonToday: '오늘 픽업 {n}건', oSoonTomorrow: '내일 픽업 {n}건', oView: '예약 보기', oPickups: '케이크 픽업', oLog: '기록',
    cakeList: '케이크 목록', cakeListD: '예약할 때 고르는 케이크예요. 숨기면 목록에서 빠지지만 지난 예약에는 남아요.', cakeAdd: '케이크 추가', cakeNamePh: '새 케이크 이름', cakeHide: '숨기기', cakeShow: '다시 보이기',
    push: '예약 알림', pushD: '케이크 픽업 전에 이 기기로 알림이 와요. 아이폰·아이패드는 홈 화면에 추가한 앱에서 켜야 해요.', pushDisable: '이 기기 알림 끄기', pushOffOk: '이 기기 알림을 껐어요.',
    remWhen: '알림 시간 (사장만 바꿀 수 있어요)', remEve: '픽업 전날 알림', remMorn: '픽업 당일 알림', remEarly: '미리 알림', remNone: '없음', remDays: '{n}일 전', remHour: '{h}시', remNow: '지금 설정: {s}', pushOn: '이 기기에서 알림 받는 중', pushOff: '이 기기는 알림이 꺼져 있어요', pushEnable: '이 기기에서 알림 받기',
    pushOk: '알림을 켰어요.', pushDenied: '알림이 거부됐어요. 기기 설정에서 알림을 허용해주세요.', pushNeedHome: '아이폰·아이패드는 공유 → 홈 화면에 추가한 뒤, 그 아이콘으로 열어서 눌러주세요.', pushUnsupported: '이 브라우저는 알림을 지원하지 않아요.',
    noteBtn: '시간이 틀렸어요 · 메모 남기기', noteTitle: '정정 요청', notePh2: '예: 실제 출근은 9시였어요', noteSend: '보내기', noteSent: '사장님께 전달했어요.', noteLate: '시간이 지나서 보낼 수 없어요. 사장님께 직접 말해주세요.', noteOffline: '인터넷이 끊겨서 보내지 못했어요. 사장님께 직접 말해주세요.',
    reqTitle: '정정 요청', reqView: '기록 보기', reqDone: '처리 완료', reqDoneOk: '처리 완료로 표시했어요.', reqTag: '정정 요청',
    histTitle: '수정 기록', histD: '근무기록을 누가, 언제, 무엇을, 왜 고쳤는지 전부 보여요. 출퇴근 버튼으로 찍힌 기록은 빼고 보여줘요.', histLoad: '수정 기록 보기', histMore: '더 보기', histNone: '아직 수정한 기록이 없어요.',
    statSoon: '다가오는 공휴일', statInDays: '{n}일 후', statTodayTag: '오늘', statElig: '공휴일 수당 대상', statSoFar: '지금까지 {n}일 근무 · 15일 필요', statNo: '대상 아님 · {n}일 근무', statNew: '입사 30일 미만', statCheck: '자격·유급 비근무일 확인 필요 ({n}일 기록됨)',
    statRule: 'BC 기준: 입사 30일 이상이고 공휴일 전 30일 중 15일 이상 일한 직원은 공휴일 평균 일당을 받아요. 공휴일에 일하면 그와 별도로 일한 시간은 1.5배예요. 근무일 외 유급휴가·병가와 공휴일 수당 등 필요한 자료를 확인한 뒤 평균 일당을 확정하세요.',
    missingAlert: '확인이 필요한 기록이 {n}건 있어요 (퇴근 누락 등).', fix: '고치러 가기',
    devicesNow: '매장 기기', lastSeen: '마지막 연결 {t}', never: '아직 연결 안 됨', ago: '{n}분 전', agoH: '{n}시간 전', agoD: '{n}일 전', justNow: '방금',
    cardsTitle: '근무기록', allStaff: '전체 직원', onlyIssues: '확인 필요만', addRecord: '기록 추가', cardsHint: '기록을 누르면 시간을 고칠 수 있어요. 누가 언제 왜 고쳤는지 모두 남아요.',
    noCards: '근무기록이 없어요', noCardsD: '매장 아이패드에서 출퇴근하면 여기에 쌓여요.', loadMore: '이전 기록 더 보기',
    offlineTag: '오프라인 기록', offlineTip: '인터넷이 끊겼을 때 아이패드에 저장됐다가 올라온 기록이에요. 시간이 맞는지 확인하세요.', missingOut: '퇴근 누락', missingIn: '출근 누락', edited: '수정됨', manualTag: '직접 입력', staff: '직원', loc: '지점', date: '날짜', inT: '출근', outT: '퇴근',
    note: '메모', notePh: '예: 마감 청소로 30분 늦게 퇴근', reason: '수정 이유', reasonPh: '예: 퇴근 안 찍음', save: '저장', needTime: '날짜와 출근 또는 퇴근 시간을 넣어주세요.', saved: '저장했어요', deleted: '지웠어요', delQ: '이 기록을 지울까요? (이력은 남아요)',
    history: '변경 이력', kioskActor: '매장 아이패드', manual: '직접 수정', none: '없음', loading: '불러오는 중…',
    actCreate: '추가', actUpdate: '수정', actDelete: '삭제', actRestore: '복구', actKiosk: '출퇴근 찍음',
    payTitle: '급여', prev: '이전 기간', next: '다음 기간', thisPeriod: '이번 기간',
    totalHours: '총 근무시간', totalPay: '지급 합계 (세전)', toCheck: '확인 필요', checkNone: '빠진 기록 없음', checkSome: '확인 필요 {n}건 — 아래 표시를 확인하세요',
    reg: '일반', ot15: '초과 1.5배', ot2: '초과 2배', stat: '공휴일 근무', stat2: '공휴일 12h 초과', tips: '팁', wage: '시급', gross: '급여', vac: '휴가수당', statAvg: '공휴일 수당',
    statYes: '{d} 공휴일 수당 {a}', statUnknown: '{d} 공휴일 수당: 자격과 유급 비근무일 등 자료를 확인해 주세요', noWage: '시급 없음', wageChanged: '기간 중 시급 변경',
    noPay: '이 기간에 근무 기록이 없어요.', tapDetail: '직원을 누르면 날짜별 내역이 보여요.',
    tipsTitle: '이 기간 팁 총액', tipsHint: 'Square를 연결하면 자동으로 들어와요. 지금은 지점별 총액을 넣으면 {m} 나눠요.', byHours: '근무시간 비율로', equally: '똑같이',
    copy: '엑셀용 표 복사', copied: '복사했어요. 엑셀에 붙여넣으면 표로 들어가요.', selected: '아래 표를 선택했어요. 복사해서 엑셀에 붙여넣으세요.',
    csvSum: '요약 CSV 받기', csvDetail: '상세 CSV 받기 (회계사용)', xlsx: '엑셀 파일 받기', xlsxHint: '엑셀 Calculation 시트에서 분류된 시간·근무일별 시급을 고치면 합계가 다시 계산됩니다. 근무시간을 바꾸면 초과근무 분류도 확인하세요.', xlsxBusy: '엑셀 파일 만드는 중…', xlsxDone: '엑셀 파일을 받았어요.',
    shSum: '급여 요약', shDetail: '근무 상세', period2: '급여 기간', rules2: '배율', dowCol: '요일', total: '합계', wageMixed: '근무일별 시급으로 계산',
    backup: '백업', backupD: '직원, 시급 이력, 모든 근무기록, 변경 이력, 팁, 설정을 엑셀 파일 하나로 받아요. 2주에 한 번 받아두면 안전해요.', backupBtn: '전체 백업 받기', backupLast: '마지막 백업: {d}', backupNever: '아직 백업한 적 없음', backupDone: '백업 파일을 받았어요.', backupDue: '백업한 지 2주가 넘었어요. 버튼 한 번이면 돼요.', backupGo: '백업 받기',
    shStaff: '직원', shWages: '시급 이력', shPunches: '근무기록', shLog: '변경 이력', shTips: '팁', shSettings: '설정', colDeleted: '삭제됨', colSource: '입력', colAt: '시각', colWho: '누가', colAction: '내용', colBefore: '이전', colAfter: '이후', colActive: '재직', colStart: '입사일', colId: 'ID', yes: '예', no: '아니요',
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
    staffHint: 'Staff don’t sign in here. Clock in and out on the store iPad with your name and PIN. This screen is for the owner and managers.',
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
    tabOrders: 'Cake orders', kClockTab: 'Clock', kOrdersTab: 'Cake orders',
    oTitle: 'Cake orders', oAdd: 'New order', oUpcoming: 'Upcoming', oPast: 'Past', oNone: 'No orders', oNoneD: 'Tap [New order] to add a cake pre-order.',
    oToday: 'Today', oTomorrow: 'Tomorrow', oInDays: 'in {n} days', oAgo: '{n} days ago', oNoTime: 'Time TBD',
    oDate: 'Pickup date', oTime: 'Pickup time', oCust: 'Customer', oPhone: 'Phone', oCakes: 'Cakes', oQty: 'Qty', oAddLine: '+ Add cake', oOther: 'Other (see note)', oNote: 'Note', oNotePh: 'e.g. “Happy Birthday Jimin” on top, 3 candles',
    oPaid: 'Payment', unpaid: 'Unpaid', deposit: 'Deposit paid', paid: 'Paid', oTaken: 'Taken by', oLoc: 'Pickup store', oPhoto: 'Receipt photo', oPhotoAdd: 'Take / choose photo', oPhotoView: 'View photo', oPhotoDel: 'Remove photo', oPhotoNew: 'New photo',
    open: 'Booked', made: 'Made', picked: 'Picked up', cancelled: 'Cancelled', oMade: 'Mark made', oPicked: 'Mark picked up', oCancel: 'Cancel order', oCancelQ: 'Cancel this order?', oReopen: 'Undo',
    oNeed: 'Enter a pickup date and at least one cake.', oSaved: 'Order saved.', oSoonToday: '{n} pickup(s) today', oSoonTomorrow: '{n} pickup(s) tomorrow', oView: 'View orders', oPickups: 'Cake pickups', oLog: 'History',
    cakeList: 'Cake list', cakeListD: 'The cakes offered when taking an order. Hidden cakes stay on past orders.', cakeAdd: 'Add cake', cakeNamePh: 'New cake name', cakeHide: 'Hide', cakeShow: 'Show',
    push: 'Order reminders', pushD: 'This device gets reminders before cake pickups. On iPhone/iPad, turn it on from the home-screen app.', pushDisable: 'Turn off on this device', pushOffOk: 'Reminders turned off on this device.',
    remWhen: 'Reminder times (owner only)', remEve: 'Day before pickup', remMorn: 'Pickup day', remEarly: 'Early reminder', remNone: 'None', remDays: '{n} days before', remHour: '{h}:00', remNow: 'Current: {s}', pushOn: 'Reminders on for this device', pushOff: 'Reminders off for this device', pushEnable: 'Get reminders on this device',
    pushOk: 'Reminders turned on.', pushDenied: 'Notifications were blocked. Allow them in the device settings.', pushNeedHome: 'On iPhone/iPad: Share → Add to Home Screen, open the app from that icon, then tap this.', pushUnsupported: 'This browser does not support notifications.',
    noteBtn: 'Time is wrong · leave a note', noteTitle: 'Correction request', notePh2: 'e.g. I actually started at 9', noteSend: 'Send', noteSent: 'Sent to the owner.', noteLate: 'Too late to send. Please tell the owner directly.', noteOffline: 'No internet — not sent. Please tell the owner directly.',
    reqTitle: 'Correction requests', reqView: 'Open record', reqDone: 'Mark done', reqDoneOk: 'Marked as done.', reqTag: 'Correction',
    histTitle: 'Edit history', histD: 'Who changed which time record, when and why. Plain clock-in/out taps are left out.', histLoad: 'Show edit history', histMore: 'Load more', histNone: 'No edits yet.',
    statSoon: 'Upcoming stat holidays', statInDays: 'in {n} days', statTodayTag: 'today', statElig: 'Gets stat pay', statSoFar: '{n} days so far · needs 15', statNo: 'Not eligible · {n} days', statNew: 'Employed under 30 days', statCheck: 'Confirm eligibility and paid non-work days ({n} days recorded)',
    statRule: 'BC: staff employed 30+ days who worked 15 of the 30 days before the holiday get an average day’s pay. Hours worked on the holiday are paid 1.5× on top. Confirm paid leave, sick days and statutory holiday pay before finalizing average day pay.',
    missingAlert: '{n} record(s) need review (missing clock-out etc.).', fix: 'Fix now',
    devicesNow: 'Store devices', lastSeen: 'last seen {t}', never: 'never connected', ago: '{n} min ago', agoH: '{n} h ago', agoD: '{n} d ago', justNow: 'just now',
    cardsTitle: 'Timesheet', allStaff: 'All staff', onlyIssues: 'Needs review only', addRecord: 'Add record', cardsHint: 'Tap a record to correct it. Who changed what, when and why is kept.',
    noCards: 'No time records', noCardsD: 'Records appear here when staff clock in on the store iPad.', loadMore: 'Load older records',
    offlineTag: 'Saved offline', offlineTip: 'Saved on the iPad while the internet was down, uploaded later. Check the time.', missingOut: 'No clock-out', missingIn: 'No clock-in', edited: 'Edited', manualTag: 'Manual', staff: 'Staff', loc: 'Location', date: 'Date', inT: 'In', outT: 'Out',
    note: 'Note', notePh: 'e.g. stayed 30 min for closing', reason: 'Reason', reasonPh: 'e.g. forgot to clock out', save: 'Save', needTime: 'Enter a date and a clock-in or clock-out time.', saved: 'Saved', deleted: 'Deleted', delQ: 'Delete this record? (history is kept)',
    history: 'History', kioskActor: 'Store iPad', manual: 'Manual edit', none: 'none', loading: 'Loading…',
    actCreate: 'added', actUpdate: 'edited', actDelete: 'deleted', actRestore: 'restored', actKiosk: 'clocked',
    payTitle: 'Payroll', prev: 'Previous period', next: 'Next period', thisPeriod: 'Current period',
    totalHours: 'Total hours', totalPay: 'Total to pay (gross)', toCheck: 'Needs review', checkNone: 'Nothing missing', checkSome: '{n} item(s) need review — see the marks below',
    reg: 'Regular', ot15: 'OT 1.5×', ot2: 'OT 2×', stat: 'Stat worked', stat2: 'Stat over 12h', tips: 'Tips', wage: 'Wage', gross: 'Pay', vac: 'Vacation pay', statAvg: 'Stat pay',
    statYes: '{d} stat pay {a}', statUnknown: '{d} stat pay: review eligibility and paid non-work records', noWage: 'No wage', wageChanged: 'Wage changed in period',
    noPay: 'No hours in this period.', tapDetail: 'Tap a person to see each day.',
    tipsTitle: 'Tips this period', tipsHint: 'These come in automatically once Square is connected. For now, enter each location’s total and it is split {m}.', byHours: 'by hours worked', equally: 'equally',
    copy: 'Copy for Excel', copied: 'Copied. Paste into Excel to get a table.', selected: 'The table below is selected. Copy it and paste into Excel.',
    csvSum: 'Download summary CSV', csvDetail: 'Download detail CSV (for accountant)', xlsx: 'Download Excel file', xlsxHint: 'Edit classified hours and daily wages on the Calculation sheet to recalculate totals. Recheck overtime classification when hours change.', xlsxBusy: 'Building the Excel file…', xlsxDone: 'Excel file downloaded.',
    shSum: 'Payroll summary', shDetail: 'Shifts', period2: 'Pay period', rules2: 'Rates', dowCol: 'Day', total: 'Total', wageMixed: 'Calculated with the wage effective on each work date',
    backup: 'Backup', backupD: 'Staff, wage history, every time record, change history, tips and settings in one Excel file. Download one every two weeks to be safe.', backupBtn: 'Download full backup', backupLast: 'Last backup: {d}', backupNever: 'No backup yet', backupDone: 'Backup downloaded.', backupDue: 'Over two weeks since the last backup. One tap.', backupGo: 'Back up now',
    shStaff: 'Staff', shWages: 'Wage history', shPunches: 'Time records', shLog: 'Change history', shTips: 'Tips', shSettings: 'Settings', colDeleted: 'Deleted', colSource: 'Entry', colAt: 'When', colWho: 'Who', colAction: 'Action', colBefore: 'Before', colAfter: 'After', colActive: 'Employed', colStart: 'Start date', colId: 'ID', yes: 'Yes', no: 'No',
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

Object.assign(TXT.ko, {"conflict":"다른 화면에서 먼저 변경했습니다. 입력을 보관했으니 최신 내용을 확인한 뒤 다시 편집해 주세요.","invalid_items":"케이크 이름과 수량(1~99개)을 확인해 주세요.","storage_write_failed":"기기에 기록을 저장하지 못했습니다. 완료되지 않았으니 관리자에게 알려주세요.","storage_corrupt":"보관된 기록을 읽지 못했습니다. 초기화하지 말고 관리자에게 알려주세요.","pending_review":"이 직원의 미확인 출퇴근 기록이 있습니다. 관리자 확인이 필요합니다.","pending_submission":"미완료 저장이 있습니다. 새로고침해서 기존 요청부터 확인해 주세요.","save_in_progress":"저장 중입니다. 잠시 기다려 주세요.","queuedOnly":"기기에만 보관했습니다","queueReview":"미확인 출퇴근 기록","queueHelp":"완료되지 않은 기록입니다. 삭제하지 말고 관리자에게 확인받으세요.","inviteCode":"초대 코드","inviteCodeHelp":"이 코드를 초대한 사람에게 직접 전달하세요. 7일 뒤 만료되며 한 번만 사용할 수 있습니다.","acceptInvite":"초대 확인","invalid_invite":"초대 코드나 이메일을 확인해 주세요.","needsReview":"확인 필요: 미확인 금액이 있어 확정 내보내기를 할 수 없습니다.","statReviewTitle":"공휴일 자격·평균 일당 확인","qualified":"자격 있음","notQualified":"자격 없음","reviewNote":"확인 근거 (유급휴가·병가 등 포함)","reviewSave":"확인 결과 저장","reviewPick":"자격을 확인해 주세요","affiliationNote":"지점 선택은 소속 직원의 전체 근무 급여입니다. 지점별 파일을 합산하지 마세요.","weekOT":"주간 초과","invalid_time":"날짜와 시간을 확인해 주세요.","nonexistent_local_time":"서머타임 전환으로 존재하지 않는 시각입니다.","ambiguous_local_time":"두 번 존재하는 시각입니다. 원본 UTC 시각을 확인해 주세요."});
Object.assign(TXT.en, {"conflict":"Another screen changed this record. Your input is kept; review the latest record before editing again.","invalid_items":"Check cake names and quantities (1–99).","storage_write_failed":"Could not save on this device. The entry is not complete; contact a manager.","storage_corrupt":"Stored records cannot be read. Do not reset; contact a manager.","pending_review":"This employee has an unconfirmed clock entry. A manager must review it.","pending_submission":"An earlier save is unconfirmed. Reload to check that request first.","save_in_progress":"Saving. Please wait.","queuedOnly":"Stored on this device only","queueReview":"Unconfirmed clock entries","queueHelp":"These entries are incomplete. Keep them and contact a manager.","inviteCode":"Invitation code","inviteCodeHelp":"Give this code directly to the invited person. Expires in 7 days; works once.","acceptInvite":"Accept invitation","invalid_invite":"Check the invitation code and email.","needsReview":"Unconfirmed amounts prevent final export.","statReviewTitle":"Review holiday eligibility and average pay","qualified":"Eligible","notQualified":"Not eligible","reviewNote":"Review evidence (including paid leave and sick days)","reviewSave":"Save review","reviewPick":"Confirm eligibility","affiliationNote":"Location selects affiliated staff with all their work. Do not add location exports together.","weekOT":"Weekly overtime","invalid_time":"Check the date and time.","nonexistent_local_time":"This wall time does not exist because of a clock change.","ambiguous_local_time":"This wall time occurs twice. Check the original UTC timestamp."});
TXT.ko.sub += ' · 밴쿠버 시간'; TXT.en.sub += ' · Vancouver time';
const cfg = window.RICOTTA_CONFIG || {};
if (cfg.localTest !== false || cfg.url !== 'https://pyxunhxrkeefgaduhibv.supabase.co' || location.origin !== 'https://gig0892.github.io' || !location.pathname.startsWith('/ricotta-staff/')) throw new Error('Production configuration mismatch.');
const sb = cfg.url && window.supabase ? window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

const app = { mode: 'boot', authView: 'in', authMsg: '', recovering: false, hasOwner: true, email: '' };
const settingPaths={"s-ptype":["period","type"],"s-anchor":["period","anchor"],"s-round":["rounding"],"s-brk":["brk","on"],"s-brk-after":["brk","after"],"s-brk-min":["brk","minutes"],"s-ot":["ot","on"],"s-d1":["ot","d1"],"s-d1x":["ot","d1x"],"s-d2":["ot","d2"],"s-d2x":["ot","d2x"],"s-w":["ot","w"],"s-wx":["ot","wx"],"s-stat":["stat","on"],"s-statx":["stat","x"],"s-statavg":["stat","avgDay"],"s-vac":["vac","on"],"s-vacpct":["vac","pct"],"s-tips":["tipsOn"],"s-tipm":["tipMethod"],"r-eve":["remind","eveOn"],"r-eveh":["remind","eveHour"],"r-morn":["remind","mornOn"],"r-mornh":["remind","mornHour"],"r-early":["remind","earlyDays"]};
let settingWrites=Promise.resolve();
const ui = { tab: 'today', off: 0, open: {}, editId: null, newPunch: null, staffEdit: null, cardStaff: 'all', onlyIssues: false, csv: '', confirm: null, logs: {}, regOpen: false, busy: false };
let D = null; // admin data
const h = location.hash.slice(1);
if (['today', 'orders', 'cards', 'pay', 'staff', 'settings'].includes(h)) ui.tab = h;

function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { el.hidden = true; }, 3200); }
const fail = (error) => {const m=error?.message||'?';toast(TXT[prefs.lang][m]?t(m):/storage|quota/i.test(m)?t('storage_write_failed'):/fetch|network/i.test(m)?t('netFail'):t('saveFail',{m}));};

Object.assign(TXT.ko,{"overnight_review":"자정을 넘긴 근무입니다. 근무일 배분을 확인해 주세요.","overlap":"서로 겹치는 근무기록이 있습니다.","missing_punch":"출근 또는 퇴근 시각이 빠졌습니다.","missing_wage":"이 근무일의 시급 이력이 없습니다.","stat_review":"공휴일 자격·평균 일당을 확인해 주세요.","future_review":"공휴일이 지난 뒤 실제 기록으로 확인해 주세요.","review_note_required":"확인 근거를 5자 이상 적어 주세요."});
Object.assign(TXT.en,{"overnight_review":"Overnight shift: review allocation to work days.","overlap":"Some shifts overlap.","missing_punch":"A clock-in or clock-out is missing.","missing_wage":"No wage is recorded for this work date.","stat_review":"Review holiday eligibility and average pay.","future_review":"Review actual records after the holiday.","review_note_required":"Enter at least five characters of review evidence."});
Object.assign(TXT.ko,{"connection_required":"인터넷 연결을 확인해 주세요. 연결되어야 앱을 사용할 수 있습니다.","connectionRetry":"연결 다시 확인","submitUnknown":"서버 저장 여부를 확인하지 못했습니다. 연결 후 저장 상태를 확인해 주세요.","pending_submission":"저장 결과가 확인되지 않은 요청이 있습니다. 저장 상태를 확인하거나 원래 내용으로 다시 저장하세요.","confirmPending":"저장 상태 확인","retryPending":"원래 내용 다시 저장","queued":"확인할 기록 {n}건","backupBtn":"급여 자료 백업 받기","backupD":"직원·시급·근무기록·변경 이력·팁·설정을 엑셀로 받습니다. 예약·사진·로그인 정보는 포함하지 않으며 앱 전체 복구용 파일은 아닙니다."});
Object.assign(TXT.en,{"connection_required":"Check your internet connection. A connection is required to use the app.","connectionRetry":"Check connection again","submitUnknown":"Could not confirm the save. Reconnect and check its status.","pending_submission":"A save is unconfirmed. Check its status or explicitly retry the original request.","confirmPending":"Check save status","retryPending":"Retry original save","queued":"{n} entries to confirm","backupBtn":"Download payroll data backup","backupD":"Exports staff, wages, shifts, edit history, tips and settings to Excel. Orders, photos and sign-in data are excluded; this is not a full application restore."});
TXT.ko.unconfirmed_response=TXT.ko.submitUnknown;TXT.en.unconfirmed_response=TXT.en.submitUnknown;
const NET={available:true};
const connectionBox=document.createElement('div');connectionBox.id='connection-status';connectionBox.className='banner';connectionBox.style.cssText='margin:12px auto;max-width:1080px;position:sticky;top:0;z-index:100';connectionBox.hidden=true;
document.body.insertBefore(connectionBox,$('#root'));
function setConnection(available){
 NET.available=available;$('#root').inert=!available;connectionBox.hidden=available;
 if(!available)connectionBox.innerHTML='<span>'+esc(t('connection_required'))+'</span><button class="btn" id="connection-retry">'+esc(t('connectionRetry'))+'</button>';
}
const requireConnection=createOnlineGate({probe:async()=>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 let r;try{r=await sb.rpc('runtime_status').abortSignal(controller.signal);}finally{clearTimeout(timer);}
 if(r.error)throw Error('connection_required');
 if(r.data?.schema!==3||r.data.probe!==new Date(P.fromLocal('2026-11-02','09:00')).toISOString().replace('.000',''))throw Error('runtime_update_required');
 return true;
},onState:setConnection});
async function reconnect(){
 try{
  await requireConnection();
  if(app.mode==='boot')await boot();
  else if(app.mode==='kiosk'){await mutations.recover();await kioskLoad();if(K.view==='orders'){await ordersLoad();render();}}
  else if(app.mode==='admin'&&D){await mutations.recover();await loadAll();}
 }catch(error){fail(error);}
}
connectionBox.addEventListener('click',e=>{if(e.target.closest('#connection-retry'))reconnect();});
function pendingSaves(){
 const list=mutations.pending();if(!list.length)return '';
 return '<div class="banner"><div><p>'+t('pending_submission')+'</p>'+list.map(x=>'<div>'+t(x.name==='save_order'?'oTitle':x.name==='save_staff'?'tabStaff':'tabCards')+' <button class="btn" data-act="confirmPending">'+t('confirmPending')+'</button> <button class="btn" data-act="retryPending" data-id="'+esc(x.id)+'">'+t('retryPending')+'</button></div>').join('')+'</div></div>';
}
const WRITE_ACTIONS=new Set(['saveStatReview','resolveClock','acceptInvite','oSave','oStatus','kNoteSend','reqDone','cakeAdd','cakeToggle','delPunch','saveEdit','clearPin','saveStaff','addWage','regDevice','revoke','invite','delInvite','removeMember','changePw','csv','xlsx','dlSum','dlDetail','backup']);

const I = {
  orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M5 20v-6h14v6M7 14v-3h10v3M12 11V8"/><path d="M12 5.5c.8 0 1.2-.7 1.2-1.3S12 2.5 12 2.5s-1.2 1.1-1.2 1.7.4 1.3 1.2 1.3z"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
  pay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/></svg>',
  staff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
};
const av = (name) => `<span class="av">${esc(initial(name))}</span>`;
const langSeg = () => `<div class="seg lang" role="group" aria-label="Language"><button data-act="lang" data-id="ko" aria-pressed="${prefs.lang === 'ko'}">한</button><button data-act="lang" data-id="en" aria-pressed="${prefs.lang === 'en'}">EN</button></div>`;

// =====================================================================
// CAKE PRE-ORDERS (same screen on the store iPad and in the admin app)
// =====================================================================
const O = { items: [], orders: [], soon: [], past: false, editId: null, draft: null, isNew: false, photo: {}, logs: {}, confirm: null };
const inKiosk = () => app.mode === 'kiosk';
const OPEN_ST = ['open', 'made'];
const cakeSummary=o=>validItems(o.items)?safeItems(o.items).map(i=>i.name+(i.qty>1?' ×'+i.qty:'')).join(', '):t('invalid_items');
const dayLabel = (d) => { const n = P.daysBetween(today(), d); return n === 0 ? t('oToday') : n === 1 ? t('oTomorrow') : n > 1 ? t('oInDays', { n }) : t('oAgo', { n: -n }); };

async function paged(table,configure=q=>q,keys=['id']) {
 const out=[];for(let page=0;;page++){
  let q=configure(sb.from(table).select('*'));for(const key of keys)q=q.order(key);
  const {data,error}=await q.range(page*1000,page*1000+999);if(error)throw error;
  out.push(...data);if(data.length<1000)return out;
 }
}
async function ordersLoad() {
 const from=O.past?P.addDays(today(),-120):P.addDays(today(),-1),to=O.past?P.addDays(today(),-1):P.addDays(today(),400);
 if(inKiosk()){
  const {data,error}=await sb.rpc('kiosk_orders',{p_token:deviceToken(),p_from:from,p_to:to});if(error)throw error;
  O.items=data.items;O.orders=data.orders;
 }else{
  [O.items,O.orders,O.soon]=await Promise.all([
   paged('cake_items',q=>q,['sort','name','id']),
   paged('orders',q=>q.gte('pickup_date',from).lte('pickup_date',to),['pickup_date','pickup_time','id']),
   paged('orders',q=>q.gte('pickup_date',today()).lte('pickup_date',P.addDays(today(),1)),['pickup_date','pickup_time','id'])
  ]);
 }
 if(O.past)O.orders.reverse();
}
const mutations=createDurableMutations({storage:localStorage,rpc:(name,args)=>sb.rpc(name,args),ensureOnline:()=>requireConnection(),lookup:(name,args)=>sb.rpc('mutation_result',{p_kind:name.replace('save_',''),p_request:args.p_request,p_token:args.p_token??null}),actor:()=>D?.me?.id||deviceToken()||'none'});
async function orderSave(id,data,photo,version) {
 return mutations.call('save_order',{p_id:id,p_data:data,p_photo:photo??null,p_version:version??null,p_token:inKiosk()?deviceToken():null},'order:'+(id||'new'));
}
async function orderPhoto(id) {
 if(O.photo[id]!==undefined)return;
 const r=inKiosk()?await sb.rpc('kiosk_order_photo',{p_token:deviceToken(),p_id:id}):await sb.from('order_photos').select('data').eq('order_id',id).maybeSingle();
 if(r.error)throw r.error;
 O.photo[id]=inKiosk()?(r.data||''):(r.data?.data||'');
}
function resizeImage(file) {
  return new Promise((ok, no) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = no;
    img.src = URL.createObjectURL(file);
  });
}
const staffNames = () => (inKiosk() ? (K.data?.staff || []).map((s) => s.name) : (D?.staff || []).filter((s) => s.active).map((s) => s.name));
function blankOrder() {
  return { pickup_date: P.addDays(today(), 1), pickup_time: '', customer: '', phone: '', items: [{ name: O.items.find((i) => i.active)?.name || '', qty: 1 }], note: '', paid: 'unpaid', taken_by: '', loc: inKiosk() ? K.data?.device?.loc : (prefs.loc === 'all' ? 'langley' : prefs.loc), photo: null };
}
// Read the open form back into O.draft so re-renders never lose typing.
function collectDraft() {
  const box = document.querySelector('.editbox[data-okey]');
  if (!O.draft || !box || box.dataset.okey !== (O.isNew ? 'new' : O.editId)) return;
  const lines = [...document.querySelectorAll('.o-line')].map((row) => ({ name: row.querySelector('select').value, qty: Math.max(1, +row.querySelector('input').value || 1) }));
  Object.assign(O.draft, {
    pickup_date: $('#o-date').value, pickup_time: $('#o-time').value, customer: $('#o-cust').value.trim(), phone: $('#o-phone').value.trim(),
    items: lines, note: $('#o-note').value.trim(), paid: $('#o-paid').value, taken_by: $('#o-taken').value.trim(),
    loc: $('#o-loc') ? $('#o-loc').value : O.draft.loc,
  });
}
const safePhoto = (s) => (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s || '') ? s : '');
function orderForm(o) {
  const dr = O.draft, act = O.items.filter((i) => i.active);
  const names = [...new Set([...act.map((i) => i.name), ...dr.items.map((i) => i.name).filter(Boolean), t('oOther')])];
  const photo = safePhoto(dr.photo != null ? dr.photo : (o?.has_photo ? O.photo[o.id] : ''));
  const log = o && !inKiosk() ? O.logs[o.id] : null;
  return `<div class="editbox" data-okey="${o ? o.id : 'new'}">
    <div class="form">
      <label class="f">${t('oDate')}<input id="o-date" type="date" value="${dr.pickup_date}"></label>
      <label class="f">${t('oTime')}<input id="o-time" type="time" value="${dr.pickup_time}"></label>
      <label class="f">${t('oCust')}<input id="o-cust" maxlength="80" value="${esc(dr.customer)}"></label>
      <label class="f">${t('oPhone')}<input id="o-phone" type="tel" maxlength="40" value="${esc(dr.phone)}"></label>
    </div>
    <div class="set-group" style="gap:8px"><b style="font-size:13px;color:var(--muted)">${t('oCakes')}</b>
      ${dr.items.map((it, i) => `<div class="o-line inline-actions"><select class="sel" aria-label="${t('oCakes')}">${names.map((n) => `<option ${n === it.name ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <input class="sel" type="number" inputmode="numeric" min="1" max="99" value="${esc(String(it.qty))}" aria-label="${t('oQty')}" style="width:72px">
        ${dr.items.length > 1 ? `<button class="btn ghost" data-act="oDelLine" data-id="${i}" aria-label="${t('del')}">✕</button>` : ''}</div>`).join('')}
      <div><button class="btn" data-act="oAddLine">${t('oAddLine')}</button></div></div>
    <label class="f">${t('oNote')}<textarea id="o-note" class="sel" rows="3" maxlength="500" placeholder="${t('oNotePh')}" style="font:inherit;font-size:16px">${esc(dr.note)}</textarea></label>
    <div class="form">
      <label class="f">${t('oPaid')}<select id="o-paid">${['unpaid', 'deposit', 'paid'].map((p) => `<option value="${p}" ${dr.paid === p ? 'selected' : ''}>${t(p)}</option>`).join('')}</select></label>
      <label class="f">${t('oTaken')}<input id="o-taken" list="o-staff" maxlength="60" value="${esc(dr.taken_by)}"><datalist id="o-staff">${staffNames().map((n) => `<option value="${esc(n)}">`).join('')}</datalist></label>
      ${inKiosk() ? '' : `<label class="f">${t('oLoc')}<select id="o-loc">${P.LOCS.map((l) => `<option value="${l}" ${dr.loc === l ? 'selected' : ''}>${t(l)}</option>`).join('')}</select></label>`}
    </div>
    <div class="set-group" style="gap:8px"><b style="font-size:13px;color:var(--muted)">${t('oPhoto')}</b>
      ${photo ? `<img src="${photo}" alt="${t('oPhoto')}" style="max-width:min(100%,320px);border-radius:10px;border:1px solid var(--line)">` : ''}
      <div class="inline-actions"><label class="btn" style="cursor:pointer">${photo ? t('oPhotoNew') : t('oPhotoAdd')}<input id="o-photo" type="file" accept="image/*" hidden></label>
        ${o?.has_photo && O.photo[o.id] === undefined && dr.photo == null ? `<button class="btn" data-act="oPhotoView">${t('oPhotoView')}</button>` : ''}
        ${photo ? `<button class="btn ghost" data-act="oPhotoDel">${t('oPhotoDel')}</button>` : ''}</div></div>
    <div class="inline-actions"><button class="btn primary" data-act="oSave">${t('save')}</button><button class="btn ghost" data-act="oClose">${t('cancel')}</button></div>
    ${o ? (O.confirm === 'cancel' ? `<div class="confirm">${t('oCancelQ')}<button class="btn primary" data-act="oStatus" data-id="cancelled">${t('oCancel')}</button><button class="btn ghost" data-act="oNoConfirm">${t('cancel')}</button></div>`
      : `<div class="inline-actions" style="border-top:1px dashed var(--line);padding-top:12px">
        ${o.status === 'open' ? `<button class="btn" data-act="oStatus" data-id="made">${t('oMade')}</button>` : ''}
        ${OPEN_ST.includes(o.status) ? `<button class="btn primary" data-act="oStatus" data-id="picked">${t('oPicked')}</button><button class="btn ghost" data-act="oAskCancel">${t('oCancel')}</button>` : `<button class="btn" data-act="oStatus" data-id="open">${t('oReopen')}</button>`}</div>`) : ''}
    ${log ? `<div class="log"><b style="color:var(--ink)">${t('oLog')}</b>${log.map((l) => `<span>${fmtDay(P.local(Date.parse(l.at)).ymd)} ${hmOf(Date.parse(l.at))} · ${esc(logWho(l))} · ${l.action === 'create' ? t('actCreate') : Object.keys(l.new || {}).filter((k) => JSON.stringify(l.old?.[k]) !== JSON.stringify(l.new[k])).map((k) => k === 'status' ? t(l.new[k]) : k === 'paid' ? t(l.new[k]) : k === 'pickup_date' ? `${t('oDate')} ${l.new[k]}` : k === 'items' ? esc(cakeSummary(l.new)) : esc(k)).join(', ')}</span>`).join('')}</div>` : ''}
  </div>`;
}
function viewOrders() {
  const list = O.orders.filter((o) => inKiosk() || inLoc(o.loc));
  const byDay = {};
  list.forEach((o) => (byDay[o.pickup_date] ||= []).push(o));
  const pillPaid = (p) => `<span class="pill ${p === 'unpaid' ? 'alert' : p === 'paid' ? 'on' : ''}">${t(p)}</span>`;
  const dayCount = (os) => { const c = {}; os.filter((o) => OPEN_ST.includes(o.status)).forEach((o) => (o.items || []).forEach((i) => { c[i.name] = (c[i.name] || 0) + (+i.qty || 1); })); return Object.entries(c).map(([n, q]) => `${esc(n)} ${q}`).join(' · '); };
  return `
    <div class="head"><h2>${t('oTitle')}</h2>
      <div class="inline-actions"><div class="seg" role="group"><button data-act="oRange" data-id="up" aria-pressed="${!O.past}">${t('oUpcoming')}</button><button data-act="oRange" data-id="past" aria-pressed="${O.past}">${t('oPast')}</button></div>
      <button class="btn primary" data-act="oNew">${t('oAdd')}</button></div></div>
    ${O.isNew ? `<div class="card">${orderForm(null)}</div>` : ''}
    ${list.length ? `<div class="card">${Object.entries(byDay).map(([d, os]) => `
      <div class="day-h"><span>${fmtDay(d)} · ${dayLabel(d)}</span><span class="muted">${dayCount(os)}</span></div>
      ${os.map((o) => `<div class="row click" data-act="oEdit" data-id="${o.id}" style="${OPEN_ST.includes(o.status) ? '' : 'opacity:.55'}">
        <div><div class="who"><span class="num">${o.pickup_time || t('oNoTime')}</span><span>${esc(o.customer || o.phone || '—')}</span></div>
          <div class="sub"><span style="color:var(--ink);font-weight:600">${esc(cakeSummary(o))}</span>${pillPaid(o.paid)}${o.status !== 'open' ? `<span class="pill ${o.status === 'cancelled' ? '' : 'on'}">${t(o.status)}</span>` : ''}${o.has_photo ? '<span class="pill">📷</span>' : ''}${!inKiosk() && prefs.loc === 'all' ? `<span>${t(o.loc)}</span>` : ''}</div>
          ${o.note ? `<div class="sub" style="color:var(--ink)">${esc(o.note)}</div>` : ''}</div>
        <div class="note">${esc(o.phone)}</div></div>${O.editId === o.id ? orderForm(o) : ''}`).join('')}`).join('')}</div>`
    : (O.isNew ? '' : `<div class="card empty"><h3>${t('oNone')}</h3><p class="note">${t('oNoneD')}</p></div>`)}`;
}
// Today / tomorrow pickups (open or made), for banners.
const soonOrders = () => { const td = today(), tm = P.addDays(td, 1); const os = (inKiosk()?O.orders:O.soon).filter((o) => OPEN_ST.includes(o.status) && (inKiosk() || inLoc(o.loc))); return { today: os.filter((o) => o.pickup_date === td), tomorrow: os.filter((o) => o.pickup_date === tm) }; };

async function orderAction(act, el, id) {
  if (act === 'oRange') { O.past = id === 'past'; O.editId = null; O.isNew = false; O.draft = null; await ordersLoad().catch(fail); render(); return true; }
  if (act === 'oNew') { O.isNew = true; O.editId = null; O.draft = blankOrder(); O.confirm = null; render(); $('#o-cust')?.focus(); return true; }
  if (act === 'oEdit') {
    if (O.editId === id) { O.editId = null; O.draft = null; render(); return true; }
    const o = O.orders.find((x) => x.id === id);
    O.editId = id; O.isNew = false; O.confirm = null;
    O.draft = { pickup_date: o.pickup_date, pickup_time: o.pickup_time, customer: o.customer, phone: o.phone, items: safeItems(o.items), note: o.note, paid: o.paid, taken_by: o.taken_by, loc: o.loc, photo: null };
    if (!O.draft.items.length) O.draft.items = [{ name: O.items[0]?.name || '', qty: 1 }];
    render();
    if (!inKiosk() && !O.logs[id]) { const { data } = await sb.from('order_log').select('*').eq('order_id', id).order('id'); O.logs[id] = data || []; render(); }
    return true;
  }
  if (act === 'oClose') { O.editId = null; O.isNew = false; O.draft = null; render(); return true; }
  if (act === 'oAddLine') { collectDraft(); O.draft.items.push({ name: O.items.find((i) => i.active)?.name || '', qty: 1 }); render(false); return true; }
  if (act === 'oDelLine') { collectDraft(); O.draft.items.splice(+id, 1); render(false); return true; }
  if (act === 'oPhotoView') { collectDraft(); await orderPhoto(O.editId); render(); return true; }
  if (act === 'oPhotoDel') { collectDraft(); O.draft.photo = ''; render(); return true; }
  if (act === 'oAskCancel') { collectDraft(); O.confirm = 'cancel'; render(); return true; }
  if (act === 'oNoConfirm') { collectDraft(); O.confirm = null; render(); return true; }
  if (act === 'oSave' || act === 'oStatus') {
    collectDraft();
    const dr = O.draft;
    dr.items = dr.items.filter((i) => i.name);
    if (!dr.pickup_date || !validItems(dr.items)) { toast(t('oNeed')); if (!dr.items.length) dr.items.push({ name: '', qty: 1 }); return true; }
    const data = { pickup_date: dr.pickup_date, pickup_time: dr.pickup_time, customer: dr.customer, phone: dr.phone, items: dr.items, note: dr.note, paid: dr.paid, taken_by: dr.taken_by };
    if (!inKiosk()) data.loc = dr.loc;
    if (act === 'oStatus') data.status = id;
    el.disabled = true;
    try {
      const existing=O.orders.find(o=>o.id===O.editId);
      const row=await orderSave(O.isNew?null:O.editId,act==='oStatus'?{status:id}:data,act==='oStatus'?null:dr.photo,existing?.version);
      if (act === 'oSave' && dr.photo != null) O.photo[row.id] = dr.photo;
      delete O.logs[row.id];
      O.editId = null; O.isNew = false; O.draft = null; O.confirm = null;
      await ordersLoad();
      toast(act === 'oStatus' ? t(id) : t('oSaved'));
    } catch (err) { fail(err); }
    render();
    return true;
  }
  return false;
}
document.addEventListener('change', async (e) => {
  if (e.target.id !== 'o-photo' || !e.target.files?.[0]) return;
  collectDraft();
  try { O.draft.photo = await resizeImage(e.target.files[0]); } catch (err) { fail(err); }
  render();
});

// ---------- web push ----------
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const b64u = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
async function pushCheck() {
  const before = app.pushOn;
  await pushCheckInner();
  return before !== app.pushOn;
}
async function pushCheckInner() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (!sub) { app.pushOn = false; return; }
    const { data } = await sb.rpc('push_status', { p_endpoint: sub.endpoint });
    app.pushOn = !!data;
  } catch { app.pushOn = false; }
}
async function pushEnable() {
  if (cfg.localTest) { toast(prefs.lang === 'ko' ? '테스트 환경에서는 실제 알림을 보내지 않습니다.' : 'Real notifications are disabled in this test environment.'); return; }
  if (isIOS() && !isStandalone()) { toast(t('pushNeedHome')); return; }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !cfg.vapidPublicKey) { toast(t('pushUnsupported')); return; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast(t('pushDenied')); return; }
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(cfg.vapidPublicKey) }));
  const j = sub.toJSON();
  const args = { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth };
  const { error } = inKiosk() ? await sb.rpc('kiosk_push_subscribe', { p_token: deviceToken(), ...args }) : await sb.rpc('push_subscribe', args);
  if (error) throw error;
  app.pushOn = true; toast(t('pushOk')); render();
}
async function pushDisable() {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager?.getSubscription();
  if (sub) {
    const { error } = inKiosk() ? await sb.rpc('kiosk_push_unsubscribe', { p_token: deviceToken(), p_endpoint: sub.endpoint }) : await sb.rpc('push_unsubscribe', { p_endpoint: sub.endpoint });
    if (error) throw error;
    await sub.unsubscribe();
  }
  app.pushOn = false; toast(t('pushOffOk')); render();
}
const remCfg = () => Object.assign({ eveOn: true, eveHour: 17, mornOn: true, mornHour: 8, earlyDays: 0 }, (D?.settings || {}).remind || {});
const remSummary = () => { const r = remCfg(); return [r.earlyDays ? t('remDays', { n: r.earlyDays }) : '', r.eveOn ? `${t('remEve')} ${t('remHour', { h: r.eveHour })}` : '', r.mornOn ? `${t('remMorn')} ${t('remHour', { h: r.mornHour })}` : ''].filter(Boolean).join(' · ') || t('remNone'); };
const remForm = () => {
  if (inKiosk() || !D) return '';
  const r = remCfg(), dis = isOwner() ? '' : 'disabled';
  const hours = (from, to, v) => Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => `<option value="${h}" ${+v === h ? 'selected' : ''}>${t('remHour', { h })}</option>`).join('');
  return `<div class="set-group" style="border-top:1px dashed var(--line);padding-top:12px"><b style="font-size:13px;color:var(--muted)">${t('remWhen')}</b>
    <div class="form">
      <label class="f"><span class="check"><input type="checkbox" id="r-eve" ${r.eveOn ? 'checked' : ''} ${dis}> ${t('remEve')}</span><select id="r-eveh" ${dis}>${hours(12, 21, r.eveHour)}</select></label>
      <label class="f"><span class="check"><input type="checkbox" id="r-morn" ${r.mornOn ? 'checked' : ''} ${dis}> ${t('remMorn')}</span><select id="r-mornh" ${dis}>${hours(6, 12, r.mornHour)}</select></label>
      <label class="f">${t('remEarly')}<select id="r-early" ${dis}>${[0, 2, 3, 7].map((n) => `<option value="${n}" ${+r.earlyDays === n ? 'selected' : ''}>${n ? t('remDays', { n }) : t('remNone')}</option>`).join('')}</select></label>
    </div></div>`;
};
const pushCard = () => `<div class="card pad set-group"><h3>${t('push')}</h3><p class="note">${t('pushD')}</p>
  ${app.pushOn ? `<p><span class="pill on">✓</span> ${t('pushOn')}</p><div><button class="btn" data-act="pushDisable">${t('pushDisable')}</button></div>` : `<p class="muted">${t('pushOff')}</p><div><button class="btn primary" data-act="pushEnable">${t('pushEnable')}</button></div>`}
  ${inKiosk() ? '' : `<p class="note">${t('remNow', { s: remSummary() })}</p>`}${remForm()}</div>`;

// =====================================================================
// KIOSK (store iPad)
// =====================================================================
const K = { view: 'clock', soon: null, data: store.get(K_CACHE, null), online: true, pick: null, pin: '', shake: false, done: null, lastTouch: Date.now() };
const deviceToken = () => store.get(K_DEVICE, null);
const queue = () => kioskQueue.read();

async function kioskLoad() {
  if(!NET.available){K.online=false;return;}
  await kioskFlush();
  const { data, error } = await sb.rpc('kiosk_state', { p_token: deviceToken() });
  if (error) {
    if (/bad_device/.test(error.message)) { store.del(K_DEVICE); store.del(K_CACHE); app.authMsg = t('deviceRevoked'); app.mode = 'login'; render(); return; }
    K.online = false;
  } else {
    K.online = true; K.data = data; store.set(K_CACHE, data);
    const so = await sb.rpc('kiosk_orders', { p_token: deviceToken(), p_from: today(), p_to: P.addDays(today(), 1) });
    if (!so.error) { const os = so.data.orders.filter((o) => OPEN_ST.includes(o.status)); K.soon = { today: os.filter((o) => o.pickup_date === today()).length, tomorrow: os.filter((o) => o.pickup_date !== today()).length }; }
  }
  if (app.mode === 'kiosk' && !K.noting && K.view === 'clock') renderKiosk();
}

const kioskQueue=createKioskQueue({storage:localStorage,lookup:item=>sb.rpc('kiosk_result',{p_token:deviceToken(),p_client:item.id}),reviewStatus:async()=>{const {data,error}=await sb.rpc('kiosk_review_status',{p_token:deviceToken()});return error?[]:data;},send:item=>sb.rpc('kiosk_punch',{p_token:deviceToken(),p_staff:item.staff,p_action:item.action,p_pin:item.pin,p_at:item.offline===false?null:item.at,p_client:item.id})});
async function kioskFlush(options){const result=await kioskQueue.flush(options);K.online=result.online;return result;}
async function kioskSubmit(action){
 const staff=K.data.staff.find(s=>s.id===K.pick);if(!staff||K.busy)return;
 K.busy=true;
 try{
  await requireConnection();
  const previous=await kioskFlush();if(!previous.online)throw new Error('connection_required');
  const id=uuid(),at=new Date().toISOString(),pin=staff.has_pin?K.pin:null;K.pin='';
  kioskQueue.enqueue({id,staff:staff.id,action,pin,at,offline:false,onlineOnly:true});
  const flushed=await kioskFlush({submit:id}),saved=flushed.replies[id],pending=kioskQueue.read().find(x=>x.id===id);
  if(saved?.rejected){K.pick=null;renderKiosk();toast(saved.result==='bad_pin'?t('wrongPin'):saved.result==='pin_locked'?t('pinLocked'):t('saveFail',{m:saved.result}));return;}
  if(pending?.status==='review'){K.pick=null;renderKiosk();toast(t('pending_review'));return;}
  if(saved){
   K.done={name:staff.name,action,time:hmOf(Date.parse(action==='in'?saved.in:saved.out)),client:id};
   K.pick=null;await kioskLoad();renderKiosk();doneTimer();
  }else{
   K.done=null;K.pick=null;renderKiosk();toast(t('submitUnknown'));
  }
 }catch(error){K.pick=null;renderKiosk();fail(error);}finally{K.busy=false;}
}

function doneTimer() { clearTimeout(doneTimer.h); doneTimer.h = setTimeout(() => { K.done = null; renderKiosk(); }, 3500); }

function renderKiosk(collect=true) {
  if (app.mode !== 'kiosk') return; // timers from the clock screen must never draw over login/admin
  if(collect)collectDraft();
  document.documentElement.lang = prefs.lang;
  const d = K.data;
  const now = new Date();
  if (!d) { $('#root').innerHTML = `<div class="auth"><p class="muted">${t('loading')}</p></div>`; return; }
  const pick = d.staff.find((s) => s.id === K.pick);
  const queued=queue(),q=queued.length,blocked=queued.filter(x=>x.status==='review');
  const working = d.staff.filter((s) => s.open);
  $('#root').innerHTML = `
    <header class="k-top">
      <div class="brand"><b>Cafe Ricotta</b><span class="where">${esc(t(d.device.loc))}</span></div>
      <div class="seg" role="group"><button data-act="kView" data-id="clock" aria-pressed="${K.view === 'clock'}">${t('kClockTab')}</button><button data-act="kView" data-id="orders" aria-pressed="${K.view === 'orders'}">${t('kOrdersTab')}</button></div>
      <span class="k-clock" id="kClock">${hmOf(now.getTime())}</span>
      ${langSeg()}
    </header>
    ${pendingSaves()}
    ${K.view === 'orders' ? `<main class="k-main">${viewOrders()}${pushCard()}<div class="k-foot"><span></span><button class="btn ghost" data-act="kAdmin">${t('admin')}</button></div></main>` : `<main class="k-main">
      ${blocked.length?`<div class="banner"><div><b>${t('queueReview')}</b><p>${t('queueHelp')}</p>${blocked.map(x=>`<div>${esc(d.staff.find(s=>s.id===x.staff)?.name||x.staff)} · ${esc(P.local(Date.parse(x.at)).ymd)} ${esc(P.local(Date.parse(x.at)).hm)} · ${esc(x.action)} · ${esc(x.reason)}</div>`).join('')}</div></div>`:''}
    ${K.soon && (K.soon.today || K.soon.tomorrow) ? `<div class="banner"><span>🎂 ${[K.soon.today ? t('oSoonToday', { n: K.soon.today }) : '', K.soon.tomorrow ? t('oSoonTomorrow', { n: K.soon.tomorrow }) : ''].filter(Boolean).join(' · ')}</span><button class="btn" data-act="kView" data-id="orders">${t('oView')}</button></div>` : ''}
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
    </main>`}
    ${pick ? `<div class="k-sheet" data-act="kCancel"><div class="card k-panel" role="dialog" aria-modal="true" aria-label="${esc(pick.name)}">
      <h3>${esc(pick.name)} · ${pick.open ? t('clockOut') : t('clockIn')}</h3>
      <p class="muted">${pick.open ? t('since', { t: hmOf(Date.parse(pick.open)) }) : t('off')}</p>
      ${pick.has_pin ? `<p>${t('enterPin')}</p>
        <div class="dots ${K.shake ? 'shake' : ''}" aria-label="PIN">${[0, 1, 2, 3].map((i) => `<i class="${i < K.pin.length ? 'on' : ''}"></i>`).join('')}</div>
        <div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'x', '0', '<'].map((k) => k === 'x' ? `<button data-act="kCancel" style="font-family:var(--sans);font-size:16px">${t('cancel')}</button>` : k === '<' ? `<button data-act="kKey" data-id="<" aria-label="${t('del')}">⌫</button>` : `<button data-act="kKey" data-id="${k}">${k}</button>`).join('')}</div>`
      : `<button class="btn primary k-action" data-act="kGo">${pick.open ? t('clockOut') : t('clockIn')}</button>
         <button class="btn ghost" data-act="kCancel">${t('cancel')}</button>`}
    </div></div>` : ''}
    ${K.done && K.noting ? `<div class="done"><div class="k-note"><div class="big" style="font-size:30px">${esc(K.done.name)} · ${t('noteTitle')}</div><textarea id="kNoteText" maxlength="300" placeholder="${t('notePh2')}"></textarea><div class="inline-actions" style="justify-content:center"><button class="btn primary" data-act="kNoteSend" style="background:var(--on-strong);color:var(--strong)">${t('noteSend')}</button><button class="btn" data-act="kNoteCancel">${t('cancel')}</button></div></div></div>` : ''}
    ${K.done && !K.noting ? `<div class="done" data-act="kDone"><div><div class="big">${esc(K.done.name)}<br>${K.done.pending?t('queuedOnly'):K.done.action==='in'?t('doneIn'):t('doneOut')}</div><div class="t">${K.done.time}</div>${K.done.note ? `<p>${esc(K.done.note)}</p>` : ''}${K.done.client ? `<button class="btn" data-act="kNote" style="margin-top:22px">${t('noteBtn')}</button>` : ''}<p>${t('tapToClose')}</p></div></div>` : ''}`;
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
    ${deviceToken() ? `<button class="btn" data-act="toKiosk">${t('backToClock')}</button>` : `<p class="note" style="text-align:center">${t('staffHint')}</p>`}
  </div>`;
}

async function onAuthSubmit(form) {
  const f = new FormData(form), email = String(f.get('email') || '').trim().toLowerCase(), pw = String(f.get('pw') || '');
  app.email = email; ui.busy = true; app.authMsg = '';
  const redirectTo = location.origin + location.pathname;
  try {
    await requireConnection();
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
  } catch (e) { console.error('auth_flow', e); app.authMsg = e.message || t('netFail'); fail(e); }
  finally { ui.busy = false; if (app.mode === 'login') renderLogin(); }
}

// =====================================================================
// ADMIN
// =====================================================================
const isOwner = () => D?.role === 'owner';
const normPunch = (r) => ({ id: r.id, version: r.version, staffId: r.staff_id, loc: r.loc, inMs: r.clock_in ? Date.parse(r.clock_in) : null, outMs: r.clock_out ? Date.parse(r.clock_out) : null, source: r.source, offline: !!r.offline, note: r.note || '', updated: r.updated_at, created: r.created_at });
const staffById = (id) => D.staff.find((s) => s.id === id);
const inLoc = (loc) => prefs.loc === 'all' || loc === prefs.loc || loc === 'both';
const statName = (st) => (prefs.lang === 'ko' ? st.ko : st.en);

async function enterAdmin() {
  const { data: role, error } = await sb.rpc('join_team');
  if (error) { fail(error); app.mode = 'login'; render(); return; }
  const { data: { user } } = await sb.auth.getUser();
  if (!role) { app.mode = 'noaccess'; app.email = user?.email || ''; render(); return; }
  D = { role, me: user, requests: [], staff: [], wages: [], punches: [], loadedFrom: null, devices: [], members: [], invites: [], tips: {}, settings: null };
  app.mode = 'admin';
  try { await mutations.recover(); } catch(error) { fail(error); }
  if(deviceToken())try{await kioskFlush();}catch(error){fail(error);}
  K.lastTouch = Date.now();
  await loadAll();
}

async function fetchAllPunches(from) {
  const out = [];
  for (let page = 0; ; page++) {
    const { data, error } = await sb.from('punches').select('*').eq('deleted', false).gte('ts', iso(P.fromLocal(from, '00:00'))).order('ts').order('id').range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

async function loadAll(minFrom) {
 try {
  const localReviews=[];
  for(const x of queue()){
   const r=await sb.rpc('import_clock_review',{p_client:x.id,p_staff:x.staff,p_action:x.action,p_at:x.at,p_reason:x.reason||'unconfirmed_local_record'});
   if(r.error)throw r.error;localReviews.push(r.data);
  }
  if(localReviews.length)kioskQueue.acknowledgeReviews(localReviews);
  const [staff,settings,devices,members,requests]=await Promise.all([
   paged('staff',q=>q,['sort','name','id']),sb.from('settings').select('data').eq('id',1).single(),
   paged('devices',q=>q,['created_at','id']),paged('members',q=>q,['user_id']),
   paged('requests',q=>q.eq('resolved',false),['created_at','id'])
  ]);
  if(settings.error)throw settings.error;
  D.staff=staff;D.settings=settings.data.data;D.devices=devices;D.members=members;D.requests=requests;
  if(!O.draft)await ordersLoad();
  if(isOwner()){
   const [wages,invites,tips,reviews]=await Promise.all([
    paged('staff_wages',q=>q,['effective','id']),paged('invites',q=>q,['created_at','email']),
    paged('tips',q=>q,['period_start','loc']),paged('payroll_stat_reviews',q=>q,['date','staff_id'])
   ]);
   D.wages=wages.map(w=>({id:w.id,staffId:w.staff_id,wage:+w.wage,effective:w.effective}));
   D.invites=invites;D.tips=Object.fromEntries(tips.map(x=>[x.period_start+'|'+x.loc,+x.amount]));
   D.statReviews=reviews.map(x=>({...x,amount:+x.amount}));
  }
  const want=P.addDays(P.periodRange(D.settings,Math.min(ui.off,-1),today()).start,-45);
  const from=[minFrom,want,D.loadedFrom].filter(Boolean).sort()[0];
  if(isOwner()){
   const snap=await sb.rpc('payroll_snapshot',{p_from:from});if(snap.error)throw snap.error;
   D.staff=snap.data.staff;D.settings=snap.data.settings;D.punches=snap.data.punches.map(normPunch);
   D.wages=snap.data.wages.map(w=>({id:w.id,staffId:w.staff_id,wage:+w.wage,effective:w.effective}));
   D.tips=Object.fromEntries(snap.data.tips.map(x=>[x.period_start+'|'+x.loc,+x.amount]));D.statReviews=snap.data.reviews.map(x=>({...x,amount:+x.amount}));
  }else D.punches=(await fetchAllPunches(from)).map(normPunch);
  D.clockReviews=await paged('clock_reviews',q=>q.eq('resolved',false),['at','client_id']);D.loadedFrom=from;D.loadError=false;
 }catch(error){D.loadError=true;fail(error);}
 render();
}

function guide() {
  const hasStaff = D.staff.length > 0, hasDev = D.devices.some((d) => !d.revoked);
  return `<div class="cap">${t('guideTitle')}</div><div class="steps">
    <div class="card step click ${hasStaff ? 'complete' : ''}" data-act="guideStaff" role="button" tabindex="0"><span class="n">1</span><b>${t('g1')}</b><span class="note">${t('g1d')}</span></div>
    <div class="card step click ${hasDev ? 'complete' : ''}" data-act="guideDevice" role="button" tabindex="0"><span class="n">2</span><b>${t('g2')}</b><span class="note">${t('g2d')}</span></div>
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
    ${isOwner() && D.punches.length && (!D.settings.lastBackup || P.daysBetween(D.settings.lastBackup, td) > 14) ? `<div class="banner"><span>${t('backupDue')}</span><button class="btn" data-act="backup">${t('backupGo')}</button></div>` : ''}
    ${miss ? `<div class="banner"><span><span class="pill alert">!</span> ${t('missingAlert', { n: miss })}</span><button class="btn" data-act="goIssues">${t('fix')}</button></div>` : ''}
    <div class="card">
      <div class="day-h"><span>${t('onNow')}</span><span class="num">${open.length}</span></div>
      ${open.length ? open.map((p) => { const s = staffById(p.staffId); return `<div class="row"><div><div class="who">${av(s?.name)}<span>${esc(s?.name)}</span></div><div class="sub"><span>${t(p.loc)}</span></div></div><div class="num">${hmOf(p.inMs)} · ${hrs((now - p.inMs) / 3600e3)}h</div></div>`; }).join('') : `<div class="row"><span class="muted">${t('nobody')}</span></div>`}
      <div class="day-h"><span>${t('todayLog')} · ${fmtDay(td)}</span><span class="num">${todays.length}</span></div>
      ${todays.length ? todays.map((p) => { const s = staffById(p.staffId); return `<div class="row"><div><div class="who">${av(s?.name)}<span>${esc(s?.name)}</span></div><div class="sub"><span>${t(p.loc)}</span></div></div><div class="num">${p.inMs ? hmOf(p.inMs) : '?'} – ${p.outMs ? hmOf(p.outMs) : ''}</div></div>`; }).join('') : `<div class="row"><span class="muted">${t('noToday')}</span></div>`}
    </div>
    ${D.requests.filter((r) => inLoc(staffById(r.staff_id)?.loc || 'all')).length ? `<div class="card"><div class="day-h"><span>${t('reqTitle')}</span><span class="num">${D.requests.length}</span></div>${D.requests.map((r) => { const s = staffById(r.staff_id); const p = D.punches.find((x) => x.id === r.punch_id); return `<div class="row"><div><div class="who">${av(s?.name)}<span>${esc(s?.name)}</span></div><div class="sub"><span>${fmtDay(P.local(Date.parse(r.created_at)).ymd)} ${hmOf(Date.parse(r.created_at))}</span>${p ? `<span class="num">${p.inMs ? hmOf(p.inMs) : '?'} – ${p.outMs ? hmOf(p.outMs) : '?'}</span>` : ''}</div><div style="margin-top:4px">“${esc(r.message)}”</div></div><div class="inline-actions">${r.punch_id ? `<button class="btn" data-act="reqOpen" data-id="${r.punch_id}">${t('reqView')}</button>` : ''}<button class="btn primary" data-act="reqDone" data-id="${r.id}">${t('reqDone')}</button></div></div>`; }).join('')}</div>` : ''}
    ${(() => { const s = soonOrders(); const os = [...s.today, ...s.tomorrow]; return os.length ? `<div class="card"><div class="day-h"><span>🎂 ${t('oPickups')}</span><button class="btn" data-act="goTab" data-tab="orders" style="padding:3px 10px">${t('oView')}</button></div>${os.map((o) => `<div class="row"><div><div class="who"><span class="num">${o.pickup_date === today() ? t('oToday') : t('oTomorrow')} ${o.pickup_time || ''}</span><span>${esc(o.customer || o.phone)}</span></div><div class="sub"><span style="color:var(--ink)">${esc(cakeSummary(o))}</span>${o.paid === 'unpaid' ? `<span class="pill alert">${t('unpaid')}</span>` : ''}${o.status === 'made' ? `<span class="pill on">${t('made')}</span>` : ''}</div></div></div>`).join('')}</div>` : ''; })()}
    ${statCard()}
    ${devs.length ? `<div class="card"><div class="day-h"><span>${t('devicesNow')}</span></div>${devs.map((d) => `<div class="row"><div><b>${esc(d.name)}</b><div class="sub"><span>${t(d.loc)}</span></div></div><div class="note">${t('lastSeen', { t: ago(d.last_seen) })}</div></div>`).join('')}</div>` : ''}
    ${setupDone ? '' : guide()}`;
}

const logWho = (l) => (l.actor ? (D.members.find((m) => m.user_id === l.actor)?.email || '?') : t('kioskActor'));
const logVal = (k, v) => v == null || v === '' ? t('none') : (k === 'clock_in' || k === 'clock_out') ? `${fmtDay(P.local(Date.parse(v)).ymd)} ${hmOf(Date.parse(v))}` : k === 'staff_id' ? (staffById(v)?.name || '?') : k === 'loc' ? t(v) : String(v);
const LOG_ACT = { create: 'actCreate', update: 'actUpdate', delete: 'actDelete', restore: 'actRestore', kiosk: 'actKiosk' };
const LOG_KEY = { clock_in: 'inT', clock_out: 'outT', staff_id: 'staff', note: 'note', loc: 'loc' };
function logLine(l, withStaff) {
  const changes = l.old ? Object.keys(l.new || {}).filter((k) => JSON.stringify(l.old[k]) !== JSON.stringify(l.new[k]) && k !== 'deleted' && k !== 'offline').map((k) => `${t(LOG_KEY[k] || 'loc')} ${esc(logVal(k, l.old[k]))} → ${esc(logVal(k, l.new[k]))}`).join(', ') : '';
  const sid = (l.new || l.old || {}).staff_id;
  const subj = withStaff && sid ? ` · <b style="color:var(--ink)">${esc(staffById(sid)?.name || '?')}</b>` : '';
  const when = l.new?.clock_in || l.new?.clock_out;
  const what = withStaff && when && !l.old ? ` ${fmtDay(P.local(Date.parse(when)).ymd)} ${hmOf(l.new.clock_in ? Date.parse(l.new.clock_in) : null)}–${hmOf(l.new.clock_out ? Date.parse(l.new.clock_out) : null)}` : '';
  return `<span>${fmtDay(P.local(Date.parse(l.at)).ymd)} ${hmOf(Date.parse(l.at))} · ${esc(logWho(l))}${subj} · ${t(LOG_ACT[l.action] || 'actUpdate')}${what}${changes ? ' · ' + changes : ''}${l.reason ? ` · “${esc(l.reason)}”` : ''}</span>`;
}

function editForm(p, isNew) {
  const draft=ui.punchDraft?.key===(isNew?'new':p.id)?ui.punchDraft:null;
  const date = draft?.date || (isNew ? today() : P.punchDay(p));
  const staffOpts = D.staff.filter((s) => s.active || s.id === p.staffId);
  const log = ui.logs[p.id];
  const reqs = isNew ? [] : D.requests.filter((r) => r.punch_id === p.id);
  return `<div class="editbox" data-punch="${isNew ? 'new' : p.id}">
    ${reqs.map((r) => `<div class="banner"><span><span class="pill alert">${t('reqTag')}</span> “${esc(r.message)}”</span><button class="btn" data-act="reqDone" data-id="${r.id}">${t('reqDone')}</button></div>`).join('')}
    <div class="form">
      <label class="f">${t('staff')}<select id="e-staff">${staffOpts.map((s) => `<option value="${s.id}" ${(draft?.staff||p.staffId)===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="f">${t('loc')}<select id="e-loc">${P.LOCS.map((l) => `<option value="${l}" ${(draft?.loc||p.loc)===l?'selected':''}>${t(l)}</option>`).join('')}</select></label>
      <label class="f">${t('date')}<input id="e-date" type="date" value="${date}"></label>
      <label class="f">${t('inT')}<input id="e-in" type="time" value="${draft?.in??(p.inMs?hmOf(p.inMs):'')}"></label>
      <label class="f">${t('outT')}<input id="e-out" type="time" value="${draft?.out??(p.outMs?hmOf(p.outMs):'')}"></label>
      <label class="f">${t('reason')}<input id="e-reason" value="${esc(draft?.reason||'')}" placeholder="${t('reasonPh')}"></label>
    </div>
    <label class="f">${t('note')}<input id="e-note" maxlength="300" value="${esc(draft?.note??p.note??'')}" placeholder="${t('notePh')}"></label>
    ${ui.confirm === 'delPunch' ? `<div class="confirm">${t('delQ')}<button class="btn primary" data-act="delPunch">${t('del')}</button><button class="btn ghost" data-act="noConfirm">${t('cancel')}</button></div>`
      : `<div class="inline-actions"><button class="btn primary" data-act="saveEdit">${t('save')}</button><button class="btn ghost" data-act="cancelEdit">${t('cancel')}</button>${isNew ? '' : `<button class="btn ghost" data-act="askDelPunch">${t('del')}</button>`}</div>`}
    ${isNew ? '' : `<div class="log"><b style="color:var(--ink)">${t('history')}</b>${!log ? t('loading') : log.map((l) => logLine(l, false)).join('')}</div>`}
  </div>`;
}

function viewCards() {
  const td = today(), now = Date.now();
  const staffOpts = D.staff.filter((s) => inLoc(s.loc));
  const list = visiblePunches()
    .filter((p) => ui.cardStaff === 'all' || p.staffId === ui.cardStaff)
    .filter((p) => !ui.onlyIssues || P.isMissing(p, now) || p.offline || D.requests.some((r) => r.punch_id === p.id))
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
          <div class="sub"><span class="num">${p.inMs ? hmOf(p.inMs) : '?'} – ${p.outMs ? hmOf(p.outMs) : '?'}</span><span>${t(p.loc)}</span>${missOut ? `<span class="pill alert">${t('missingOut')}</span>` : ''}${missIn ? `<span class="pill alert">${t('missingIn')}</span>` : ''}${live ? `<span class="pill on">${t('working')}</span>` : ''}${p.offline ? `<span class="pill alert" title="${t('offlineTip')}">${t('offlineTag')}</span>` : ''}${D.requests.some((r) => r.punch_id === p.id) ? `<span class="pill alert">${t('reqTag')}</span>` : ''}${p.source === 'manual' ? `<span class="pill">${t('manualTag')}</span>` : edited ? `<span class="pill">${t('edited')}</span>` : ''}</div>${p.note ? `<div class="sub" style="color:var(--ink)">${t('note')}: ${esc(p.note)}</div>` : ''}</div>
          <div class="num">${p.inMs && p.outMs ? hrs(P.shiftHours(p, D.settings)) + 'h' : '—'}</div></div>${ui.editId === p.id ? editForm(p, false) : ''}`;
      }).join('')}`).join('')}</div>`
    : `<div class="card empty"><h3>${t('noCards')}</h3><p class="note">${t('noCardsD')}</p></div>`}
    <div><button class="btn" data-act="loadMore">${t('loadMore')}</button> <span class="note">${fmtDay(D.loadedFrom)} ~</span></div>`;
}

function currentPayroll() {
  const range = P.periodRange(D.settings, ui.off, today());
  const result=P.payroll({staff:D.staff,wages:D.wages,punches:D.punches,settings:D.settings,tips:D.tips,range,nowMs:Date.now(),locFilter:prefs.loc,statReviews:D.statReviews||[]});
  if(D.loadError||hasUnconfirmedPayrollWrite(mutations.pending())||queue().some(x=>{const d=P.local(Date.parse(x.at)).ymd;return d>=range.start&&d<=range.end;})||(D.clockReviews||[]).some(x=>{const d=P.local(Date.parse(x.at)).ymd;return d>=range.start&&d<=range.end;})){result.ready=false;result.issues.push('unconfirmed_records');}return result;
}

function viewPay() {
  if (!isOwner()) return `<div class="card empty"><p class="muted">${t('ownerOnly')}</p></div>`;
  const report=currentPayroll(), { range, rows }=report, st = D.settings, o = st.ot;
  const tot = (k) => rows.reduce((a, r) => a + r[k], 0);
  const flags=rows.reduce((n,r)=>n+r.issues.length,0)+currentPayroll().issues.length;
  const locs = prefs.loc === 'all' ? P.LOCS : [prefs.loc];
  return `
    <div class="head"><h2>${t('payTitle')}</h2>
      <div class="inline-actions"><button class="btn" data-act="per" data-d="-1" aria-label="${t('prev')}">‹</button><b class="num" style="font-size:14px">${fmtDay(range.start)} – ${fmtDay(range.end)}</b><button class="btn" data-act="per" data-d="1" aria-label="${t('next')}" ${ui.off >= 0 ? 'disabled' : ''}>›</button>${ui.off === 0 ? `<span class="pill on">${t('thisPeriod')}</span>` : ''}</div></div>
    ${!currentPayroll().ready?`<div class="banner">${t('needsReview')}</div>`:''}<p class="note">${t('affiliationNote')}</p>
    <div class="sum">
      <div class="card kpi"><div class="cap">${t('totalHours')}</div><div class="v">${hrs(tot('hours'))}</div></div>
      <div class="card kpi"><div class="cap">${t('totalPay')}</div><div class="v">${report.ready?money(tot('total')):'—'}</div>${!report.ready?'<div class="note">'+t('needsReview')+'</div>':''}</div>
      <div class="card kpi"><div class="cap">${t('toCheck')}</div><div class="v">${flags}</div><div class="note">${flags ? t('checkSome', { n: flags }) : t('checkNone')}</div></div>
    </div>
    ${st.tipsOn ? `<div class="card pad set-group"><b>${t('tipsTitle')}</b>
      <div class="tipbox">${locs.map((l) => `<label class="f">${t(l)} ($)<input type="number" inputmode="decimal" min="0" step="0.01" data-tip="${range.start}|${l}" value="${D.tips[`${range.start}|${l}`] ?? ''}" placeholder="0.00" style="width:150px"></label>`).join('')}</div>
      <p class="note">${t('tipsHint', { m: st.tipMethod === 'equal' ? t('equally') : t('byHours') })}</p></div>` : ''}
    ${rows.some(r=>r.statAvg.some(x=>x.status==='unknown'))?'<h3>'+t('statReviewTitle')+'</h3>':''}
${rows.map(r=>r.statAvg.filter(x=>x.status==='unknown').map(x=>{const key=r.staff.id+'|'+x.date,dr=(ui.statDraft||{})[key]||{};return `<div class="card pad stat-review" data-staff="${r.staff.id}" data-date="${x.date}">
<b>${esc(r.staff.name)} · ${fmtDay(x.date)}</b><p class="note">${t('reviewNote')}</p>
<div class="form"><label class="f">${t('reviewPick')}<select data-review="qualified"><option value="">—</option><option value="yes" ${dr.qualified==='yes'?'selected':''}>${t('qualified')}</option><option value="no" ${dr.qualified==='no'?'selected':''}>${t('notQualified')}</option></select></label>
<label class="f">${t('statAvg')} ($)<input data-review="amount" type="number" step="0.01" min="0" value="${esc(dr.amount||'')}"></label></div>
<label class="f">${t('reviewNote')}<input data-review="note" value="${esc(dr.note||'')}" minlength="5"></label>
<button class="btn" data-act="saveStatReview" data-id="${r.staff.id}|${x.date}">${t('reviewSave')}</button></div>`;}).join('')).join('')}
    ${rows.length ? `<div class="card">${rows.map((r) => `
      <div class="pay-card" data-act="toggle" data-id="${r.staff.id}">
        <div class="pay-top"><div class="who">${av(r.staff.name)}<span>${esc(r.staff.name)}</span>${r.missing ? `<span class="pill alert">${t('toCheck')} ${r.missing}</span>` : ''}${r.noWage ? `<span class="pill alert">${t('noWage')}</span>` : ''}</div><div class="amt">${r.issues.length?'—':money(r.total)}</div></div>
        <div class="break"><span>${t('reg')} <b>${hrs(r.reg)}</b></span>${r.x15 ? `<span>${t('ot15')} <b>${hrs(r.x15)}</b></span>` : ''}${r.x2 ? `<span>${t('ot2')} <b>${hrs(r.x2)}</b></span>` : ''}${r.stat ? `<span>${t('stat')} <b>${hrs(r.stat)}</b></span>` : ''}${r.stat2 ? `<span>${t('stat2')} <b>${hrs(r.stat2)}</b></span>` : ''}
          <span>${t('wage')} <b>${r.wagesUsed.length > 1 ? r.wagesUsed.map(money).join(' → ') : money(r.wage)}</b></span><span>${t('gross')} <b>${money(r.gross)}</b></span>${r.statAvgTotal ? `<span>${t('statAvg')} <b>${money(r.statAvgTotal)}</b></span>` : ''}${st.vac?.on ? `<span>${t('vac')} <b>${money(r.vac)}</b></span>` : ''}${st.tipsOn ? `<span>${t('tips')} <b>${money(r.tips)}</b></span>` : ''}</div>
        ${r.issues.filter(x=>x!=='stat_review').map(x=>'<div class="note">'+t(x)+'</div>').join('')}
        ${r.statAvg.filter((x) => x.status === 'unknown').map((x) => `<div class="note"><span class="pill alert">!</span> ${t('statUnknown', { d: fmtDay(x.date) })}</div>`).join('')}
        ${ui.open[r.staff.id] ? `<div class="days">${r.days.map((c) => `<div><span>${fmtDay(c.date)}</span><span class="num muted">${c.punches.map((p) => hmOf(p.inMs) + '–' + hmOf(p.outMs)).join(', ')}${P.statOn(c.date) && st.stat.on ? ' · ' + esc(statName(P.statOn(c.date))) : ''}</span><span class="num">${hrs(c.hours)}h</span></div>`).join('')}
          ${r.statAvg.filter((x) => x.status === 'yes').map((x) => `<div><span>${fmtDay(x.date)}</span><span class="muted">${t('statAvg')}</span><span class="num">${money(x.amount)}</span></div>`).join('')}</div>` : ''}
      </div>`).join('')}</div>
      <div class="inline-actions"><button class="btn primary" data-act="xlsx">${t('xlsx')}</button><button class="btn" data-act="csv">${t('copy')}</button><button class="btn" data-act="dlSum">${t('csvSum')}</button><button class="btn" data-act="dlDetail">${t('csvDetail')}</button></div>
      <p class="note">${t('xlsxHint')} ${t('tapDetail')}</p>
      ${ui.csv ? `<textarea class="out" id="csvOut" readonly aria-label="CSV">${esc(ui.csv)}</textarea>` : ''}`
    : `<div class="card empty"><p class="muted">${t('noPay')}</p></div>`}
    <p class="note">${t('ruleNote', { d1: o.d1, x1: o.d1x, d2: o.d2, x2: o.d2x, w: o.w, wx: o.wx, sx: st.stat.x })}</p>`;
}

function requirePayrollReady(){if(!currentPayroll().ready)throw new Error(t('needsReview'));}
function summaryTable() {
  requirePayrollReady();
  const { range, rows } = currentPayroll();
  const head = [t('staff'), t('loc'), t('reg'), t('ot15'), t('ot2'), t('stat'), t('stat2'), t('totalHours'), t('wage'), t('gross'), t('statAvg'), t('vac'), t('tips'), t('totalPay')];
  const body = rows.map((r) => [r.staff.name, t(r.staff.loc), hrs(r.reg), hrs(r.x15), hrs(r.x2), hrs(r.stat), hrs(r.stat2), hrs(r.hours), r.wagesUsed.map((w) => w.toFixed(2)).join(' / ') || r.wage.toFixed(2), r.gross.toFixed(2), r.statAvgTotal.toFixed(2), r.vac.toFixed(2), r.tips.toFixed(2), r.total.toFixed(2)]);
  return { range, lines: [head, ...body] };
}
function detailTable() {
  requirePayrollReady();
  const { range, rows } = currentPayroll();
  const head = [t('staff'), t('date'), t('loc'), t('inT'), t('outT'), t('totalHours'), t('wage'), t('note')];
  const body = [];
  for (const r of rows) for (const c of r.days) for (const p of c.punches) body.push([r.staff.name, c.date, t(p.loc), hmOf(p.inMs), hmOf(p.outMs), hrs(P.shiftHours(p, D.settings)), P.wageOn(D.wages, r.staff.id, c.date).toFixed(2), p.note || '']);
  return { range, lines: [head, ...body] };
}
// ---------- Excel ----------
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js'; s.onload = () => ok(window.XLSX); s.onerror = no; document.head.appendChild(s); });
}
const colLetter = (i) => String.fromCharCode(65 + i);
function sheetFrom(X, rows, widths) {
  const ws = X.utils.aoa_to_sheet(rows);
  if (widths) ws['!cols'] = widths.map((wch) => ({ wch }));
  return ws;
}
async function payrollXlsx(){
 await loadAll();requirePayrollReady();
 const snapshot=structuredClone(currentPayroll()),settings=structuredClone(D.settings),wages=structuredClone(D.wages);
 toast(t('xlsxBusy'));const X=await loadXLSX();
 const wb=payrollWorkbook(X,snapshot,settings,wages,t);
 X.writeFile(wb,'ricotta-payroll-'+snapshot.range.start+'_'+snapshot.range.end+'.xlsx');toast(t('xlsxDone'));
}
async function fetchAll(table,order){const keys=table==='tips'?['period_start','loc']:table==='members'?['user_id']:table==='invites'?['email']:table==='settings'?['id']:[order,'id'].filter((x,i,a)=>a.indexOf(x)===i);return paged(table,q=>q,keys);}
async function backupXlsx() {
  toast(t('xlsxBusy'));
  const X = await loadXLSX();
  const [staff, wages, punches, log, tips] = await Promise.all([fetchAll('staff', 'created_at'), fetchAll('staff_wages', 'effective'), fetchAll('punches', 'ts'), fetchAll('punch_log', 'id'), fetchAll('tips', 'period_start')]);
  const name = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  const when = (v) => (v ? `${P.local(Date.parse(v)).ymd} ${hmOf(Date.parse(v))}` : '');
  const who = (l) => (l.actor ? (D.members.find((m) => m.user_id === l.actor)?.email || l.actor) : t('kioskActor'));
  const yn = (b) => (b ? t('yes') : t('no'));
  const wb = X.utils.book_new();
  const add = (rows, title, widths) => X.utils.book_append_sheet(wb, sheetFrom(X, rows, widths), title);
  add([[t('name'), t('role'), t('loc'), t('colActive'), t('colStart'), 'PIN', t('colId')], ...staff.map((s) => [s.name, s.role, t(s.loc), yn(s.active), s.start_date || '', s.has_pin ? t('pinSet') : t('pinNone'), s.id])], t('shStaff'), [14, 12, 9, 6, 11, 8, 38]);
  add([[t('staff'), t('wageFrom'), t('wage')], ...wages.map((w) => [name[w.staff_id] || w.staff_id, w.effective, +w.wage])], t('shWages'), [14, 12, 8]);
  add([[t('staff'), t('date'), t('loc'), t('inT'), t('outT'), t('note'), t('colSource'), t('colDeleted'), t('colId')], ...punches.map((p) => [name[p.staff_id] || p.staff_id, P.local(Date.parse(p.ts)).ymd, t(p.loc), p.clock_in ? hmOf(Date.parse(p.clock_in)) : '', p.clock_out ? hmOf(Date.parse(p.clock_out)) : '', p.note || '', p.source === 'kiosk' ? t('kioskActor') : t('manualTag'), yn(p.deleted), p.id])], t('shPunches'), [14, 11, 9, 7, 7, 26, 12, 7, 38]);
  add([[t('colAt'), t('colWho'), t('colAction'), t('colBefore'), t('colAfter'), t('reason'), t('colId')], ...log.map((l) => [when(l.at), who(l), l.action, l.old ? JSON.stringify(l.old) : '', l.new ? JSON.stringify(l.new) : '', l.reason || '', l.punch_id])], t('shLog'), [17, 22, 9, 50, 50, 20, 38]);
  add([[t('period2'), t('loc'), t('tips')], ...tips.map((x) => [x.period_start, t(x.loc), +x.amount])], t('shTips'), [12, 9, 9]);
  add([[t('shSettings')], [JSON.stringify(D.settings)]], t('shSettings'), [120]);
  X.writeFile(wb, `ricotta-backup-${today()}.xlsx`);
  const st = { ...D.settings, lastBackup: today() };
  const {data,error}=await sb.rpc('patch_setting',{p_path:['lastBackup'],p_value:st.lastBackup,p_expected:D.settings.lastBackup??null});if(error)throw error;D.settings=data;
  render(); toast(t('backupDone'));
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
    return `<div class="editbox" data-staffkey="${s.id||'new'}">
    <div class="form">
      <label class="f">${t('name')}<input id="st-name" value="${esc(s.name)}" maxlength="60"></label>
      <label class="f">${t('role')}<input id="st-role" value="${esc(s.role)}" placeholder="${t('rolePh')}"></label>
      <label class="f">${t('loc')}<select id="st-loc">${['langley', 'burnaby', 'both'].map((l) => `<option value="${l}" ${s.loc === l ? 'selected' : ''}>${t(l)}</option>`).join('')}</select></label>
      <label class="f">${t('startDate')}<input id="st-start" type="date" value="${s.start_date || ''}"></label>
      ${s.isNew && owner ? `<label class="f">${t('wageL')}<input id="st-wage" type="number" inputmode="decimal" step="0.05" min="0" value="${s.wageDraft??18.25}"></label>` : ''}
      <label class="f">${t('pin')} · ${s.has_pin ? t('pinSet') : t('pinNone')}<input id="st-pin" value="${esc(s.pinDraft||'')}" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="${t('pinNew')}"></label>
    </div>
    <p class="note">${t('pinHint')}${s.has_pin ? ` <button class="link" data-act="clearPin">${t('pinClear')}</button>` : ''}</p>
    <label class="check"><input type="checkbox" id="st-active" ${s.active ? 'checked' : ''}> ${t('active')}</label>
    <p class="note">${t('activeHint')}</p>
    <div class="inline-actions"><button class="btn primary" data-act="saveStaff">${t('save')}</button><button class="btn ghost" data-act="cancelStaff">${t('cancel')}</button></div>
    ${!s.isNew && owner ? `<div class="set-group" style="border-top:1px dashed var(--line);padding-top:12px">
      <b>${t('wageHist')}</b>
      <div class="log">${hist.length ? hist.map((w) => `<span class="num">${w.effective} ~ · ${money(w.wage)}</span>`).join('') : `<span>${t('noWage')}</span>`}</div>
      <div class="form"><label class="f">${t('wageNew')} ($)<input id="w-amt" value="${esc(s.nextWage||'')}" type="number" inputmode="decimal" step="0.05" min="0"></label><label class="f">${t('wageFrom')}<input id="w-from" type="date" value="${s.nextWageDate||today()}"></label></div>
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
      ${ui.inviteToken?`<div class="banner"><div>${t('inviteCodeHelp')}<input readonly value="${esc(ui.inviteToken)}" aria-label="${t('inviteCode')}"></div></div>`:''}
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
    ${pushCard()}
    <div class="card pad set-group"><h3>${t('cakeList')}</h3><p class="note">${t('cakeListD')}</p>
      <div class="card">${O.items.map((c) => `<div class="row" style="${c.active ? '' : 'opacity:.55'}"><input class="sel" data-cake="${c.id}" value="${esc(c.name)}" maxlength="60" aria-label="${t('name')}"><button class="btn" data-act="cakeToggle" data-id="${c.id}">${c.active ? t('cakeHide') : t('cakeShow')}</button></div>`).join('')}</div>
      <div class="inline-actions"><input class="sel" id="cake-new" maxlength="60" placeholder="${t('cakeNamePh')}"><button class="btn" data-act="cakeAdd">${t('cakeAdd')}</button></div></div>
    <div class="card pad set-group"><h3>${t('histTitle')}</h3><p class="note">${t('histD')}</p>
      ${ui.hist ? (ui.hist.length ? `<div class="log">${ui.hist.map((l) => logLine(l, true)).join('')}</div>` : `<p class="muted">${t('histNone')}</p>`) : ''}
      <div>${!ui.hist ? `<button class="btn" data-act="histLoad">${t('histLoad')}</button>` : ui.histMore ? `<button class="btn" data-act="histLoad">${t('histMore')}</button>` : ''}</div></div>
    ${owner ? `<div class="card pad set-group"><h3>${t('backup')}</h3><p class="note">${t('backupD')}</p><p>${st.lastBackup ? t('backupLast', { d: fmtDay(st.lastBackup) }) : t('backupNever')}</p><div><button class="btn primary" data-act="backup">${t('backupBtn')}</button></div></div>` : ''}
    <div class="card pad set-group"><h3>${t('square')}</h3><p class="note">${t('squareD')}</p><div class="inline-actions"><button class="btn primary" disabled>${t('connect')}</button><span class="pill">${t('soon')}</span></div></div>
    <div class="card pad set-group"><h3>${t('account')}</h3><p><b>${esc(D.me.email)}</b> · ${t(D.role)}</p>
      <div class="form"><label class="f">${t('newPw')}<input id="acc-pw" type="password" autocomplete="new-password" minlength="8"></label></div>
      <div class="inline-actions"><button class="btn" data-act="changePw">${t('changePw')}</button><button class="btn" data-act="signOut">${t('signOut')}</button></div></div>`;
}

const TABS = [['today', 'tabToday'], ['orders', 'tabOrders'], ['cards', 'tabCards'], ['pay', 'tabPay'], ['staff', 'tabStaff'], ['settings', 'tabSet']];
function renderAdmin() {
  document.documentElement.lang = prefs.lang;
  const tabs = TABS.filter(([id]) => id !== 'pay' || isOwner());
  if (!tabs.some(([id]) => id === ui.tab)) ui.tab = 'today';
  const view = D.settings ? { today: viewToday, orders: viewOrders, cards: viewCards, pay: viewPay, staff: viewStaff, settings: viewSettings }[ui.tab]() : `<p class="muted">${t('loading')}</p>`;
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
      ${pendingSaves()}
      ${deviceToken() ? `<div class="banner"><span>${t('kioskBanner')}</span><button class="btn primary" data-act="toKiosk">${t('toKiosk')}</button></div>` : ''}
      ${(D.clockReviews||[]).map(r=>`<div class="card pad clock-review"><b>${t('queueReview')} · ${esc(staffById(r.staff_id)?.name||'')} · ${esc(P.local(Date.parse(r.at)).ymd)} ${esc(P.local(Date.parse(r.at)).hm)}</b>
<p>${esc(r.reason)} · ${esc(r.action)}</p><label class="f">${prefs.lang==='ko'?'정정한 근무기록을 연결하거나, 근무가 아닌 입력이면 사유를 적어 제외하세요.':'Link a corrected shift, or explain why this was not work.'}
<select><option value="">${t('reviewPick')}</option><option value="none">${prefs.lang==='ko'?'근무가 아닌 입력으로 확인':'Confirmed as not worked'}</option>${D.punches.filter(p=>p.staffId===r.staff_id).map(p=>`<option value="${p.id}">${P.punchDay(p)} ${hmOf(p.inMs)}–${hmOf(p.outMs)}</option>`).join('')}</select></label>
<input minlength="5" placeholder="${t('reason')}"><button class="btn" data-act="resolveClock" data-id="${r.client_id}">${t('reviewSave')}</button></div>`).join('')}
      ${view}</section></main>`;
  window.scrollTo(0, y);
}

function renderNoAccess() {
  $('#root').innerHTML = `<div class="auth"><div class="brand"><b>Cafe Ricotta</b><span>${t('sub')}</span></div>
    <div class="card empty"><h3>${t('noAccess')}</h3><p class="note">${t('noAccessD', { e: esc(app.email) })}</p>
    <label class="f">${t('inviteCode')}<input id="accept-code" autocomplete="off"></label><button class="btn primary" data-act="acceptInvite">${t('acceptInvite')}</button>
    <div class="inline-actions"><button class="btn primary" data-act="retryJoin">${t('retry')}</button><button class="btn" data-act="signOut">${t('signOut')}</button></div></div></div>`;
}

function collectForms(){
 (ui.statDraft||={});for(const box of document.querySelectorAll('.stat-review')){ui.statDraft[box.dataset.staff+'|'+box.dataset.date]=Object.fromEntries([...box.querySelectorAll('[data-review]')].map(el=>[el.dataset.review,el.value]));}
 const box=document.querySelector('.editbox[data-punch]'),key=ui.newPunch?'new':ui.editId;
 if(box&&key&&box.dataset.punch===key)ui.punchDraft={key,staff:$('#e-staff').value,loc:$('#e-loc').value,date:$('#e-date').value,in:$('#e-in').value,out:$('#e-out').value,reason:$('#e-reason').value,note:$('#e-note').value};
 const staffBox=document.querySelector('.editbox[data-staffkey]'),f=ui.staffEdit;
 if(staffBox&&f&&staffBox.dataset.staffkey===(f.id||'new')){
  Object.assign(f,{name:$('#st-name').value,role:$('#st-role').value,loc:$('#st-loc').value,start_date:$('#st-start').value,active:$('#st-active').checked,pinDraft:$('#st-pin').value,wageDraft:$('#st-wage')?.value,nextWage:$('#w-amt')?.value,nextWageDate:$('#w-from')?.value});
 }
}
function render(collect=true) {
 if(collect)collectDraft();collectForms();
 if(!sb){$('#root').innerHTML='<div class="auth">'+t('notConfigured')+'</div>';return;}
 ({boot:()=>{$('#root').innerHTML='<div class="auth">'+t('loading')+'</div>';},kiosk:()=>renderKiosk(false),login:renderLogin,noaccess:renderNoAccess,admin:renderAdmin})[app.mode]();
}

async function toKiosk() {
  if(D)await pushDisable();
  await sb.auth.signOut();
  D = null; app.mode = 'kiosk'; K.pick = null; K.pin = ''; K.view = 'clock';
  Object.assign(O, { orders: [], editId: null, draft: null, isNew: false, photo: {}, logs: {}, confirm: null });
  renderKiosk(); kioskLoad();
}

// ---------- events ----------
document.addEventListener('click', async (e) => {
 try {
  K.lastTouch = Date.now();
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  if(WRITE_ACTIONS.has(act))await requireConnection();
  if(act==='confirmPending'||act==='retryPending'){if(act==='retryPending')await mutations.retry(id);else await mutations.recover();if(app.mode==='admin')await loadAll();else{await ordersLoad();render();}return;}
  const go = (tab) => { ui.tab = tab; ui.csv = ''; ui.confirm = null; ui.hist = null; history.replaceState(null, '', '#' + tab); render(); window.scrollTo(0, 0); };

  if(act==='saveStatReview'){
   collectForms();const [staff,date]=id.split('|'),draft=ui.statDraft[id],row=currentPayroll().rows.find(r=>r.staff.id===staff),stat=row.statAvg.find(x=>x.date===date);
   if(draft.qualified==='no'&&stat.qualified==='yes')throw new Error(prefs.lang==='ko'?'기록상 재직 30일·근무 15일 조건을 충족합니다. 자격 없음으로 처리할 수 없습니다.':'Recorded employment and worked days meet the eligibility rule; this cannot be marked ineligible.');
   if(!draft.qualified||draft.note.trim().length<5||draft.qualified==='yes'&&draft.amount==='')throw new Error(t('reviewPick'));
   const previous=(D.statReviews||[]).find(x=>x.staff_id===staff&&x.date===date);
   const {error}=await sb.rpc('save_stat_review',{p_staff:staff,p_date:date,p_qualified:draft.qualified==='yes',p_amount:draft.qualified==='yes'?+draft.amount:0,p_note:draft.note,p_basis:stat.basis,p_version:previous?.version??null});
   if(error)throw error;delete ui.statDraft[id];await loadAll();return;
  }
  if(act==='resolveClock'){
   const box=el.closest('.clock-review'),record=box.querySelector('select').value,note=box.querySelector('input').value;
   if(!record)throw new Error('reviewPick');
   const {error}=await sb.rpc('resolve_clock_review',{p_client:id,p_punch:record==='none'?null:record,p_note:note});if(error)throw error;await loadAll();return;
  }

  // shared
  if (act === 'lang') { prefs.lang = id; savePrefs(); render(); return; }
  if (act === 'toKiosk') { toKiosk(); return; }
  if (act === 'signOut') { await pushDisable(); await sb.auth.signOut(); D = null; if (deviceToken()) toKiosk(); else { app.mode = 'login'; app.authView = 'in'; render(); } return; }
  if (act === 'authView') { app.authView = id; app.authMsg = ''; renderLogin(); return; }
  if (act === 'retryJoin') {await enterAdmin();return;}
  if(act==='acceptInvite'){const {error}=await sb.rpc('accept_invite',{p_token:$('#accept-code').value.trim()});if(error)throw error;await enterAdmin();return;}

  if (act === 'pushEnable') { try { await pushEnable(); } catch (err) { fail(err); } return; }
  if (act === 'pushDisable') { try { await pushDisable(); } catch (err) { fail(err); } return; }
  if (/^o[A-Z]/.test(act) && (app.mode === 'kiosk' || app.mode === 'admin')) { if (await orderAction(act, el, id)) return; }
  if (act === 'kView') { K.view = id; O.editId = null; O.isNew = false; O.draft = null; if (id === 'orders') { renderKiosk(); try { await ordersLoad(); } catch (err) { fail(err); } pushCheck().then((changed) => { if (changed) renderKiosk(); }); } renderKiosk(); if (id === 'clock') kioskLoad(); return; }
  // kiosk
  if (act === 'kPick') { K.pick = K.pick === id ? null : id; K.pin = ''; renderKiosk(); return; }
  if (act === 'kCancel') { if (el.classList.contains('k-sheet') && e.target !== el) return; K.pick = null; K.pin = ''; renderKiosk(); return; }
  if (act === 'kGo') { const s = K.data.staff.find((x) => x.id === K.pick); el.disabled = true; kioskSubmit(s?.open ? 'out' : 'in'); return; }
  if (act === 'kKey') {
    if (K.busy) return;
    if (id === '<') K.pin = K.pin.slice(0, -1); else if (K.pin.length < 4) K.pin += id;
    renderKiosk();
    if (K.pin.length === 4) { const s = K.data.staff.find((x) => x.id === K.pick); kioskSubmit(s?.open ? 'out' : 'in'); }
    return;
  }
  if (act === 'kDone') { K.done = null; renderKiosk(); return; }
  if (act === 'kNote') { clearTimeout(doneTimer.h); K.noting = true; renderKiosk(); $('#kNoteText')?.focus(); return; }
  if (act === 'kNoteCancel') { K.noting = false; K.done = null; renderKiosk(); return; }
  if (act === 'kNoteSend') {
    const msg = $('#kNoteText').value.trim();
    if (!msg) return;
    el.disabled = true;
    const { error } = await sb.rpc('kiosk_note', { p_token: deviceToken(), p_client: K.done.client, p_message: msg });
    K.noting = false; K.done = null; renderKiosk();
    toast(!error ? t('noteSent') : /too_late/.test(error.message) ? t('noteLate') : t('noteOffline'));
    return;
  }
  if (act === 'kAdmin') {
    ui.tab = 'today'; history.replaceState(null, '', '#today');
    const { data: { session } } = await sb.auth.getSession();
    if (session) enterAdmin(); else { app.mode = 'login'; app.authView = 'in'; app.authMsg = ''; renderLogin(); }
    return;
  }

  if (app.mode !== 'admin' || !D) return;
  if (act === 'loc') { prefs.loc = id; savePrefs(); ui.cardStaff = 'all'; render(); }
  else if (act === 'goTab') go(el.dataset.tab);
  else if (act === 'guideStaff') { ui.staffEdit = { id: null, name: '', role: '', loc: prefs.loc === 'all' ? 'langley' : prefs.loc, start_date: null, active: true, has_pin: false, isNew: true }; go('staff'); }
  else if (act === 'guideDevice') { ui.regOpen = true; go('settings'); }
  else if (act === 'reqDone') {
    const { error } = await sb.from('requests').update({ resolved: true, resolved_by: D.me.id, resolved_at: new Date().toISOString() }).eq('id', id);
    if (error) return fail(error);
    toast(t('reqDoneOk')); loadAll();
  }
  else if (act === 'reqOpen') {
    ui.cardStaff = 'all'; ui.onlyIssues = false; ui.newPunch = null; ui.editId = id; go('cards');
    if (!ui.logs[id]) { const { data } = await sb.from('punch_log').select('*').eq('punch_id', id).order('id'); ui.logs[id] = data || []; render(); }
  }
  else if (act === 'histLoad') {
    const from = ui.hist ? ui.hist.length : 0;
    const { data, error } = await sb.from('punch_log').select('*').neq('action', 'kiosk').order('id', { ascending: false }).range(from, from + 49);
    if (error) return fail(error);
    ui.hist = (ui.hist || []).concat(data); ui.histMore = data.length === 50; render();
  }
  else if (act === 'cakeAdd') {
    const name = $('#cake-new').value.trim(); if (!name) return;
    const { error } = await sb.from('cake_items').insert({ name, sort: O.items.length + 1 }); if (error) return fail(error);
    await ordersLoad(); render();
  }
  else if (act === 'cakeToggle') {
    const c = O.items.find((x) => x.id === id);
    const { error } = await sb.from('cake_items').update({ active: !c.active }).eq('id', id); if (error) return fail(error);
    await ordersLoad(); render();
  }
  else if (act === 'goIssues') { ui.onlyIssues = true; ui.cardStaff = 'all'; go('cards'); }
  else if (act === 'noConfirm') { ui.confirm = null; render(); }
  // timesheet
  else if (act === 'edit') {
    if (e.target.closest('input,select,button,label,.editbox')) return;
    ui.editId = ui.editId === id ? null : id; ui.newPunch = null; ui.punchDraft=null; ui.confirm = null; render();
    if (ui.editId && !ui.logs[id]) {
      const { data } = await sb.from('punch_log').select('*').eq('punch_id', id).order('id');
      ui.logs[id] = data || []; render();
    }
  }
  else if (act === 'newPunch') {
    const sid = ui.cardStaff !== 'all' ? ui.cardStaff : (D.staff.find((s) => s.active && inLoc(s.loc)) || D.staff[0]).id;
    const s = staffById(sid);
    ui.newPunch = { staffId: sid, loc: s.loc === 'both' ? (prefs.loc === 'all' ? 'langley' : prefs.loc) : s.loc, inMs: null, outMs: null };
    ui.editId = null; ui.punchDraft=null; render();
  }
  else if (act === 'cancelEdit') { ui.newPunch = null; ui.editId = null; ui.punchDraft=null; ui.confirm = null; render(); }
  else if (act === 'askDelPunch') { ui.confirm = 'delPunch'; render(); }
  else if(act==='delPunch'){
   const reason=$('#e-reason')?.value.trim()||t('manual'),p=D.punches.find(x=>x.id===ui.editId);
   await mutations.call('save_punch',{p_id:p.id,p_data:{deleted:true,edit_reason:reason},p_version:p.version},'punch:'+p.id);
   delete ui.logs[p.id];ui.editId=null;ui.punchDraft=null;ui.confirm=null;toast(t('deleted'));await loadAll();
  }
  else if (act === 'saveEdit') {
    const d = $('#e-date').value, i = $('#e-in').value, o = $('#e-out').value;
    if (!d || (!i && !o)) { toast(t('needTime')); return; }
    const original=D.punches.find(x=>x.id===ui.editId);
    const parse=(hm,at)=>hm?(at&&P.local(at).ymd===d&&P.local(at).hm===hm?at:P.fromLocal(d,hm)):null;
    const inMs=parse(i,original?.inMs);
    let outMs=parse(o,original?.outMs);
    if (inMs != null && outMs != null && outMs === inMs) throw new Error('invalid_time');
    if (inMs != null && outMs != null && outMs < inMs) outMs = P.fromLocal(P.addDays(d, 1), o);
    const row = { staff_id: $('#e-staff').value, loc: $('#e-loc').value, note: $('#e-note').value.trim(), clock_in: iso(inMs), clock_out: iso(outMs), edit_reason: $('#e-reason').value.trim() || (ui.newPunch ? null : t('manual')) };
    const isNew = !!ui.newPunch;
    await mutations.call('save_punch',{p_id:isNew?null:ui.editId,p_data:row,p_version:isNew?null:D.punches.find(x=>x.id===ui.editId)?.version},'punch:'+(isNew?'new':ui.editId));
    if (!isNew) delete ui.logs[ui.editId];
    ui.newPunch = null; ui.editId = null; ui.punchDraft=null; toast(t('saved'));await loadAll();
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
    await loadAll();
    const { range, lines } = summaryTable();
    ui.csv = `${range.start} ~ ${range.end}\n` + lines.map((l) => l.join('\t')).join('\n');
    const fallback = () => { render(); const ta = $('#csvOut'); if (ta) { ta.focus(); ta.select(); } toast(t('selected')); };
    try { await navigator.clipboard.writeText(ui.csv); render(); toast(t('copied')); } catch { fallback(); }
  }
  else if (act === 'xlsx') { try { await payrollXlsx(); } catch (err) { fail(err); } }
  else if (act === 'backup') { try { await backupXlsx(); } catch (err) { fail(err); } }
  else if (act === 'dlSum') { await loadAll(); const { range, lines } = summaryTable(); download(`ricotta-payroll-${range.start}_${range.end}.csv`, lines); }
  else if (act === 'dlDetail') { await loadAll(); const { range, lines } = detailTable(); download(`ricotta-shifts-${range.start}_${range.end}.csv`, lines); }
  // staff
  else if (act === 'newStaff') { ui.staffEdit = { id: null, name: '', role: '', loc: prefs.loc === 'all' ? 'langley' : prefs.loc, start_date: null, active: true, has_pin: false, isNew: true }; render(); }
  else if (act === 'editStaff') { if (e.target.closest('input,select,button,label,.editbox')) return; ui.staffEdit = ui.staffEdit?.id === id ? null : { ...staffById(id) }; render(); }
  else if (act === 'cancelStaff') { ui.staffEdit = null; render(); }
  else if (act === 'clearPin') {
    const { error } = await sb.rpc('set_staff_pin', { p_staff: ui.staffEdit.id, p_pin: null });
    if (error) return fail(error);
    collectForms();ui.staffEdit.has_pin=false;ui.staffEdit.version++;ui.staffEdit.pinDraft='';toast(t('saved'));await loadAll();
  }
  else if(act==='saveStaff'){
   const f=ui.staffEdit,name=$('#st-name').value.trim(),pin=$('#st-pin').value.trim();
   if(!name){toast(t('needName'));return;}if(pin&&!/^\d{4}$/.test(pin)){toast(t('pinBad'));return;}
   const row={name,role:$('#st-role').value.trim(),loc:$('#st-loc').value,start_date:$('#st-start').value||null,active:$('#st-active').checked};
   const wage=f.isNew&&isOwner()?+($('#st-wage')?.value||0):null;
   await mutations.call('save_staff',{p_id:f.id||null,p_data:row,p_wage:wage||null,p_pin:pin||null,p_version:f.version??null},'staff:'+(f.id||'new'));
   ui.staffEdit=null;toast(t('saved'));await loadAll();
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
    if(queue().length)throw new Error('pending_review');
    const loc = $('#d-loc').value, name = $('#d-name').value.trim() || `${t(loc)} iPad`;
    const { data, error } = await sb.rpc('register_device', { p_name: name, p_loc: loc });
    if (error) return fail(error);
    writeStored(localStorage,K_DEVICE,data); store.del(K_CACHE);
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
    const {data,error}=await sb.rpc('create_invite',{p_email:email,p_role:$('#inv-role').value});if(error)throw error;
    ui.inviteToken=data;await loadAll();
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
 }catch(error){fail(error);}
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  onAuthSubmit(form);
});

document.addEventListener('change', async (e) => {
 try{
  const el = e.target;
  if (app.mode !== 'admin' || !D) return;
  if(el.dataset.cake||el.dataset.tip||settingPaths[el.id])await requireConnection();
  if (el.id === 'cardStaff') { ui.cardStaff = el.value; render(); return; }
  if (el.dataset.cake) { const name = el.value.trim(); if (!name) return; const { error } = await sb.from('cake_items').update({ name }).eq('id', el.dataset.cake); if (error) return fail(error); await ordersLoad(); toast(t('saved')); return; }
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
    'r-eve': () => { st.remind = { ...remCfg(), eveOn: el.checked }; }, 'r-eveh': () => { st.remind = { ...remCfg(), eveHour: +el.value }; },
    'r-morn': () => { st.remind = { ...remCfg(), mornOn: el.checked }; }, 'r-mornh': () => { st.remind = { ...remCfg(), mornHour: +el.value }; },
    'r-early': () => { st.remind = { ...remCfg(), earlyDays: +el.value }; },
  };
  if (!map[el.id]) return;
  map[el.id]();
  const path=settingPaths[el.id],value=path.reduce((o,k)=>o?.[k],st);
  settingWrites=settingWrites.then(async()=>{await requireConnection();const expected=path.reduce((o,k)=>o?.[k],D.settings)??null;
   const {data,error}=await sb.rpc('patch_setting',{p_path:path,p_value:value,p_expected:expected});if(error)throw error;
   D.settings=data;render();toast(t('setChanged'));
  }).catch(fail);
 }catch(error){fail(error);}
});

// ---------- timers ----------
setInterval(() => {
  const c = $('#kClock');
  if (c) c.textContent = hmOf(Date.now());
}, 10000);
setInterval(() => {
  if (app.mode === 'kiosk' && K.view === 'orders' && !O.draft && Date.now() - K.lastTouch > 5 * 60000) { K.view = 'clock'; renderKiosk(); kioskLoad(); }
  if (app.mode === 'kiosk' && K.view === 'clock') {
    if (K.pick && Date.now() - K.lastTouch > 30000) { K.pick = null; K.pin = ''; renderKiosk(); }
    if (!K.pick && !K.done) kioskLoad();
  }
  // On the store iPad, never leave the admin view open.
  if (app.mode === 'admin' && deviceToken() && Date.now() - K.lastTouch > 5 * 60000) toKiosk();
}, 30000);
setInterval(() => { if (app.mode === 'admin' && D && ui.tab === 'today' && document.visibilityState === 'visible' && !ui.editId) loadAll(); }, 60000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (app.mode === 'kiosk' && K.view === 'clock') kioskLoad();
  else if (app.mode === 'admin' && D && !O.draft && !ui.editId && !ui.staffEdit && !ui.newPunch) loadAll();
});
window.addEventListener('offline',()=>{setConnection(false);K.online=false;reconnect();});
window.addEventListener('online',reconnect);
for (const ev of ['keydown', 'input', 'touchstart']) document.addEventListener(ev, () => { K.lastTouch = Date.now(); }, { passive: true });

// ---------- boot ----------
async function boot() {
  render();
  if (!sb) return;
  await requireConnection();
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
boot().catch(error=>{$('#root').innerHTML='<div class="auth"><div class="banner">'+esc(error.message==='runtime_update_required'?(prefs.lang==='ko'?'앱과 서버의 시간대 또는 버전이 맞지 않습니다. 업데이트를 확인해 주세요.':'App/server time data or versions differ. Check updates.'):(TXT[prefs.lang][error.message]?t(error.message):error.message||'Load failed'))+'</div></div>';});

if (!cfg.localTest && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
