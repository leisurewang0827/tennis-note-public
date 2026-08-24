// 화면에 쓰는 고정 데이터 표.
//
// 전부 리터럴이다. 계산도 호출도 없다. 문구나 항목을 바꾸려면 여기만 고치면 된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 선언이라 쓰는 쪽은 예전과 같다.

const memberEnrollmentLegacyDefaults = {
  experienceLevel: "beginner",
  lessonGoal: "미수집",
  preferredSchedule: "시간표에서 선택",
};

const membershipFilterDefinitions = [
  {
    key: "scheduleScope",
    label: "이용 요일",
    options: [
      ["all", "전체"],
      ["weekday", "평일"],
      ["weekend", "주말"],
      ["mixed", "혼합"],
    ],
  },
  {
    key: "productKind",
    label: "회원권",
    options: [
      ["all", "전체"],
      ["regular", "정규권"],
      ["coupon", "쿠폰제"],
      ["consult", "상담"],
    ],
  },
  {
    key: "groupSize",
    label: "수업",
    options: [
      ["all", "전체"],
      ["1", "1대1"],
      ["2", "2대1"],
    ],
  },
  {
    key: "lessonMinutes",
    label: "시간",
    options: [
      ["all", "전체"],
      ["20", "20분"],
      ["30", "30분"],
      ["40", "40분"],
    ],
  },
];

const membershipPresetDefinitions = [
  {
    id: "four-week",
    label: "4주",
    description: "가볍게 시작·재등록",
    filters: { scheduleScope: "all", productKind: "regular", groupSize: "all", lessonMinutes: "all" },
  },
  {
    id: "three-month",
    label: "3개월",
    description: "12주 등록·보강 21일",
    filters: { scheduleScope: "all", productKind: "regular", groupSize: "all", lessonMinutes: "all" },
  },
  {
    id: "coupon",
    label: "쿠폰 레슨",
    description: "담당 코치의 빈 시간 예약",
    filters: { scheduleScope: "all", productKind: "coupon", groupSize: "1", lessonMinutes: "all" },
  },
  {
    id: "one-day",
    label: "원데이 1회",
    description: "한 번 체험·단회 레슨",
    filters: { scheduleScope: "mixed", productKind: "coupon", groupSize: "1", lessonMinutes: "all" },
  },
];

const registrationFlows = [
  { title: "운동노트 회원", detail: "간편 로그인만 하면 회원권 없이도 운동 기록을 바로 남길 수 있습니다.", steps: ["간편 로그인", "운동 기록", "사진·영상", "계속 이용"] },
  { title: "첫 회원권 구매", detail: "이름·연락처·출생연도만 확인하고 결제로 이어집니다.", steps: ["회원권 선택", "기본정보 확인", "결제", "수강 시작"] },
  { title: "재등록", detail: "현재 가입서가 유효한 회원은 다시 작성하지 않고 기존 시간과 회원권을 연장합니다.", steps: ["잔여 2회 알림", "기존 시간 보호", "결제", "연장"] },
  { title: "2대1 공동관리", detail: "한 명이 가입서와 결제를 진행해도 파트너 일정이 함께 연결됩니다.", steps: ["파트너 입력", "공동 시간표", "대표 결제", "앱 추가 연결"] },
];

const legacyCurriculumSteps = [
  {
    id: "FH-01",
    title: "포핸드 연결 안정화",
    focus: "라켓면 고정, 전진 스텝, 짧은 공 처리",
    next: "다음 수업은 짧은 공 접근 후 크로스 방향 컨트롤을 진행합니다.",
    notionSource: "Notion · 입문/초급 포핸드 DB",
    notionUrl: "https://app.notion.com/p/305b107df4808096a7f9f2a1776487ed",
  },
  {
    id: "FT-02",
    title: "풋워크와 회복 스텝",
    focus: "첫 발 반응, 중심 회복, 다음 공 준비",
    next: "다음 수업 전에는 타구 후 제자리 회복을 영상으로 확인합니다.",
    notionSource: "Notion · 풋워크/기초 움직임 DB",
    notionUrl: "https://app.notion.com/p/38ab107df4808195bff1e85caaf95dd7",
  },
  {
    id: "BH-R1",
    title: "백핸드 리턴 준비",
    focus: "스플릿 스텝, 어깨 회전, 임팩트 전 준비",
    next: "다음 수업은 백핸드 리턴 타이밍과 낮은 공 처리를 진행합니다.",
    notionSource: "Notion · 리턴/백핸드 DB",
    notionUrl: "https://app.notion.com/p/317b107df48080b6a6f4fc1c42348dd8",
  },
];

const legacyCurriculumSkillTracks = [
  {
    title: "포핸드",
    summary: "가장 많이 쓰는 스트로크라 입문 이후에도 방향, 깊이, 전술 전환으로 계속 확장합니다.",
    currentLevel: "초급",
    progress: "4/8",
    activeStepId: "FH-01",
    steps: [
      { level: "입문", id: "FH-01", title: "제자리 컨트롤", goal: "느린 공을 안정적으로 넘기기", practice: "라켓면 고정, 리듬 만들기", completion: "10구 이상 랠리 연결", notionUrl: "https://app.notion.com/p/305b107df4808096a7f9f2a1776487ed" },
      { level: "초급", id: "FH-C01", title: "크로스 기본 코스", goal: "크로스 방향으로 안정적인 랠리", practice: "대각선 감각, 타점 유지", completion: "크로스 8구 이상 연결", notionUrl: "https://app.notion.com/p/305b107df4808088b673df964a164020" },
      { level: "중급", id: "FH-T03", title: "공격 전환", goal: "짧은 공을 보고 앞으로 들어가기", practice: "어프로치, 마무리 스윙", completion: "짧은 공 처리 후 회복", notionUrl: "https://app.notion.com/p/317b107df48080afa274f62eecce42a7" },
    ],
  },
  {
    title: "백핸드",
    summary: "포핸드보다 늦게 올라오는 경우가 많아 별도 단계로 천천히 추적합니다.",
    currentLevel: "입문",
    progress: "2/6",
    activeStepId: "BH-R1",
    steps: [
      { level: "입문", id: "BH-01", title: "기본 준비 자세", goal: "백핸드 준비와 라켓면 안정", practice: "어깨 회전, 짧은 스윙", completion: "천천히 오는 공 넘기기", notionUrl: "https://app.notion.com/p/38ab107df480817cbeb6f953d1d24d9d" },
      { level: "입문", id: "BH-R1", title: "전진 타점 적용", goal: "백핸드 준비와 임팩트 안정", practice: "스플릿 스텝, 어깨 회전", completion: "느린 리턴 랠리 시작", notionUrl: "https://app.notion.com/p/317b107df48080b6a6f4fc1c42348dd8" },
      { level: "초급", id: "BH-02", title: "짧은 스윙 연결", goal: "백핸드 랠리 연결", practice: "짧은 스윙, 회복 스텝", completion: "백핸드 6구 이상 연결", notionUrl: "https://app.notion.com/p/38ab107df48081a9bab8db0ecc082980" },
    ],
  },
  {
    title: "풋워크",
    summary: "기술을 잘 쳐도 움직임이 늦으면 무너지기 때문에 별도 진행도로 봅니다.",
    currentLevel: "입문",
    progress: "3/5",
    activeStepId: "ST-01",
    steps: [
      { level: "입문", id: "ST-01", title: "풋워크 입문", goal: "첫 발과 준비 자세 만들기", practice: "스플릿 스텝, 레디 포지션", completion: "타구 후 제자리 회복", notionUrl: "https://app.notion.com/p/38ab107df4808195bff1e85caaf95dd7" },
      { level: "입문", id: "ST-PHOTO", title: "레디 포지션", goal: "기본 준비 자세 확인", practice: "정면/측면 자세 체크", completion: "상체와 라켓 위치 안정", notionUrl: "https://app.notion.com/p/38ab107df4808179ac38c384f5d6ba8d" },
      { level: "초급", id: "ST-VIDEO", title: "스플릿 스텝 기본", goal: "공 없이 첫 발 반응 만들기", practice: "스플릿 스텝, 첫 발", completion: "5회 반복 촬영 확인", notionUrl: "https://app.notion.com/p/38ab107df480817fbcb4fdd7f2da8d91" },
    ],
  },
  {
    title: "발리/네트플레이",
    summary: "처음부터 많이 하지 않아도, 게임을 시작하면 따로 열리는 기술 영역입니다.",
    currentLevel: "시작 전",
    progress: "0/5",
    activeStepId: "",
    steps: [
      { level: "입문", id: "NV-01", title: "네트플레이 이해", goal: "네트 앞 역할 이해", practice: "기본 위치, 라켓면", completion: "네트 앞 준비 자세 유지", notionUrl: "https://app.notion.com/p/317b107df48080dfa195ed6ad397c436" },
      { level: "입문", id: "NV-02", title: "기본 발리 안정", goal: "짧은 동작으로 공 막기", practice: "포핸드/백핸드 발리", completion: "느린 발리 연결", notionUrl: "https://app.notion.com/p/317b107df48080b3a731d449f1690f97" },
      { level: "초급", id: "NV-03", title: "어프로치 & 첫 발리", goal: "앞으로 들어가 첫 발리 연결", practice: "어프로치, 파트너 위치 확인", completion: "첫 발리 후 다음 공 준비", notionUrl: "https://app.notion.com/p/317b107df48081959b99c3cf91fb4f23" },
    ],
  },
  {
    title: "서브/리턴",
    summary: "실내 수업에서는 가볍게 보고, 야외 게임으로 이어질 때 확장합니다.",
    currentLevel: "입문",
    progress: "1/4",
    activeStepId: "SV-01",
    steps: [
      { level: "입문", id: "SV-01", title: "서브 기본 루틴", goal: "토스와 리듬 안정", practice: "토스 위치, 임팩트 밸런스", completion: "세컨드 서브 안정", notionUrl: "https://app.notion.com/p/38ab107df480817188a2e3f84eeb12cf" },
      { level: "입문", id: "RT-01", title: "리턴 첫 발", goal: "서브에 맞춰 빠르게 준비", practice: "스플릿 스텝, 블록 리턴", completion: "느린 서브 리턴 성공", notionUrl: "https://app.notion.com/p/317b107df480808989b8c5588935e05f" },
      { level: "초급", id: "SV-R1", title: "서브 후 첫 공 준비", goal: "서브 뒤 멈추지 않기", practice: "착지 후 스플릿 스텝", completion: "첫 공 준비 자세 유지", notionUrl: "https://app.notion.com/p/38ab107df480817188a2e3f84eeb12cf" },
    ],
  },
  {
    title: "게임 운영/복식",
    summary: "기술이 어느 정도 연결되면 포인트 흐름과 복식 위치를 따로 관리합니다.",
    currentLevel: "시작 전",
    progress: "0/6",
    activeStepId: "",
    steps: [
      { level: "입문", id: "GM-01", title: "성장 로드맵", goal: "지금 필요한 기술 찾기", practice: "목표별 커리큘럼 선택", completion: "다음 목표 설명 가능", notionUrl: "https://app.notion.com/p/317b107df480803baf48c4b5e18b2573" },
      { level: "초급", id: "TC-01", title: "중립 → 공격", goal: "유리한 공에서 공격 전환", practice: "크로스 후 다운더라인", completion: "패턴 3구 연결", notionUrl: "https://app.notion.com/p/317b107df48080aab3b9ca696dd655e6" },
      { level: "중급", id: "DB-01", title: "복식 기본 위치", goal: "전위/후위 역할 이해", practice: "자리 전환, 커버 범위", completion: "기본 포지션 유지", notionUrl: "https://app.notion.com/p/317b107df48080dfa195ed6ad397c436" },
    ],
  },
];

const ntrpReferences = [
  {
    id: "poster",
    title: "내가 만든 NTRP 포스터",
    detail: "테니스클럽하우스 NTRP 테니스 자가 레벨 측정 포스터 기준",
    image: "./assets/ntrp-poster.jpg",
    path: "C:\\Users\\user\\Documents\\자료정리\\다이너스티주식회사\\테니스클럽하우스\\커리큘럼\\2024-03-26_테니스클럽하우스_NTRP_테니스게임레벨_안내.jpg",
  },
  {
    id: "usta",
    title: "USTA 공식 NTRP 기준",
    detail: "공식 기준은 길어서 앱에서는 1.5~4.0 핵심만 가볍게 요약합니다.",
    url: "https://www.usta.com/content/dam/usta/pdfs/10013_experience_player_ntrp_characteristics1%20%282%29.pdf",
  },
];

const ntrpQuickLevels = [
  { level: "1.5", label: "입문", detail: "스트로크를 배우는 중" },
  { level: "2.0", label: "초급", detail: "타점과 위치 선정이 아직 불안정" },
  { level: "2.5", label: "초급+", detail: "느린 랠리와 기본 게임 가능" },
  { level: "3.0", label: "중급 입문", detail: "중간 속도 랠리 가능, 조절은 불안정" },
  { level: "3.5", label: "중급", detail: "방향 조절과 전술 시도" },
  { level: "4.0", label: "상급 입문", detail: "안정적 경기 운영 가능" },
];

const ntrpSurveyQuestions = [
  {
    id: "rally",
    title: "베이스라인 랠리 유지",
    options: [
      { score: 1.5, label: "아직 공을 넘기는 것 자체를 연습 중" },
      { score: 2.0, label: "천천히 치면 몇 번은 넘기지만 타점이 자주 흔들림" },
      { score: 2.5, label: "비슷한 수준과 베이스라인 랠리를 천천히 주고받을 수 있음" },
      { score: 3.0, label: "중간 속도 랠리를 이어가지만 깊이/방향/속도 조절은 불안정" },
      { score: 3.5, label: "랠리가 가능하고 방향 조절을 시도할 수 있음" },
      { score: 4.0, label: "대부분의 샷이 안정적이고 방향/길이 조절이 가능" },
    ],
  },
  {
    id: "forehand",
    title: "포핸드 안정성",
    options: [
      { score: 1.5, label: "공을 맞혀 넘기는 것을 연습 중" },
      { score: 2.0, label: "폼은 배우고 있지만 방향과 타점이 자주 흔들림" },
      { score: 2.5, label: "천천히 오는 공은 포핸드로 주고받을 수 있음" },
      { score: 3.0, label: "중간 속도 공을 비교적 꾸준히 치지만 깊이/방향 조절은 부족" },
      { score: 3.5, label: "포핸드 방향 조절과 공격 전환을 시도할 수 있음" },
      { score: 4.0, label: "포핸드로 깊이, 방향, 속도 조절이 가능하고 기회볼을 만들 수 있음" },
    ],
  },
  {
    id: "backhand",
    title: "백핸드 안정성",
    options: [
      { score: 1.5, label: "백핸드 자세를 배우는 중" },
      { score: 2.0, label: "백핸드를 피하거나 라켓면이 자주 열림" },
      { score: 2.5, label: "천천히 오는 공은 백핸드로 넘길 수 있음" },
      { score: 3.0, label: "중간 속도 백핸드 랠리가 가능하지만 공격/방향 조절은 불안정" },
      { score: 3.5, label: "백핸드 크로스와 다운더라인을 구분해 시도할 수 있음" },
      { score: 4.0, label: "백핸드에서도 깊이와 방향 조절이 가능하고 수비에서 회복할 수 있음" },
    ],
  },
  {
    id: "serve",
    title: "서브",
    options: [
      { score: 1.5, label: "서브 동작을 배우는 중" },
      { score: 2.0, label: "토스와 임팩트가 일정하지 않음" },
      { score: 2.5, label: "천천히 넣는 서브는 가능하지만 세컨서브가 불안함" },
      { score: 3.0, label: "서브를 넣고 랠리를 시작할 수 있음" },
      { score: 3.5, label: "서브 방향과 첫 볼 연결을 의식함" },
      { score: 4.0, label: "안정적인 세컨서브와 포인트 시작 능력이 있음" },
    ],
  },
  {
    id: "return",
    title: "리턴",
    options: [
      { score: 1.5, label: "서브를 받아 넘기는 감각을 배우는 중" },
      { score: 2.0, label: "느린 서브는 받아보지만 준비가 늦고 실수가 많음" },
      { score: 2.5, label: "느린 서브를 리턴해서 랠리를 시작할 수 있음" },
      { score: 3.0, label: "중간 속도 서브 리턴은 가능하지만 방향 조절이 부족" },
      { score: 3.5, label: "리턴 방향을 선택하고 다음 공 준비를 의식함" },
      { score: 4.0, label: "상대 서브에 따라 블록/공격 리턴을 구분할 수 있음" },
    ],
  },
  {
    id: "net",
    title: "네트플레이와 발리",
    options: [
      { score: 1.5, label: "네트 앞 플레이가 아직 낯섦" },
      { score: 2.0, label: "발리 자세를 배우지만 공이 뜨거나 라켓면이 흔들림" },
      { score: 2.5, label: "쉬운 발리는 넘길 수 있지만 위치 선정이 부족" },
      { score: 3.0, label: "발리 시도는 가능하지만 낮은 공/빠른 공에 약함" },
      { score: 3.5, label: "어프로치 후 발리, 로브 대응을 시도할 수 있음" },
      { score: 4.0, label: "발리, 로브, 오버헤드를 상황에 맞게 사용할 수 있음" },
    ],
  },
  {
    id: "game",
    title: "경기 이해",
    options: [
      { score: 1.5, label: "룰과 위치를 배우는 중" },
      { score: 2.0, label: "단식/복식 위치 선정이 아직 헷갈림" },
      { score: 2.5, label: "기본 위치를 알고 게임을 시도할 수 있음" },
      { score: 3.0, label: "복식에서 전위/후위 위치를 이해하고 포인트를 진행함" },
      { score: 3.5, label: "기회볼, 로브, 어프로치 등 선택을 시작함" },
      { score: 4.0, label: "포인트 패턴과 약점 공략을 생각하며 경기함" },
    ],
  },
  {
    id: "movement",
    title: "움직임과 회복",
    options: [
      { score: 1.5, label: "공 위치를 따라가는 감각을 잡는 중" },
      { score: 2.0, label: "공에 늦게 도착하거나 준비 동작이 자주 늦음" },
      { score: 2.5, label: "천천히 오는 공은 준비해서 칠 수 있음" },
      { score: 3.0, label: "중간 속도 공에 반응하지만 회복 스텝이 자주 늦음" },
      { score: 3.5, label: "타구 후 다음 위치로 회복하려고 움직임" },
      { score: 4.0, label: "코트 포지션을 선택하고 다음 공을 준비함" },
    ],
  },
  {
    id: "control",
    title: "방향/깊이/속도 조절",
    options: [
      { score: 1.5, label: "공을 코트 안에 넣는 것이 우선" },
      { score: 2.0, label: "방향을 의도해도 결과가 자주 벗어남" },
      { score: 2.5, label: "천천히 치면 코스 선택을 조금 시도할 수 있음" },
      { score: 3.0, label: "중간 속도에서 방향/깊이/속도 조절이 아직 일정하지 않음" },
      { score: 3.5, label: "방향 조절과 깊이 조절을 의식적으로 시도함" },
      { score: 4.0, label: "상황에 따라 깊이, 방향, 속도를 바꿔 포인트를 만들 수 있음" },
    ],
  },
  {
    id: "doubles",
    title: "복식 위치와 팀플레이",
    options: [
      { score: 1.5, label: "복식 위치와 룰이 아직 어렵다" },
      { score: 2.0, label: "단식/복식 기본 위치 선정이 헷갈림" },
      { score: 2.5, label: "기본 위치를 알고 게임에 참여할 수 있음" },
      { score: 3.0, label: "전위/후위 역할을 이해하고 한 명 앞, 한 명 뒤 형태로 플레이함" },
      { score: 3.5, label: "포칭, 로브 커버, 파트너 위치를 조금씩 의식함" },
      { score: 4.0, label: "팀플레이가 보이고 찬스볼 마무리와 수비 전환이 가능함" },
    ],
  },
];

const paymentMethodDefinitions = [
  { id: "card", label: "카드", shortLabel: "카드", payMethod: "CARD", detail: "신용·체크카드 결제" },
  { id: "tosspay", label: "토스페이", shortLabel: "토스페이", payMethod: "EASY_PAY", detail: "토스페이 바로 결제" },
  { id: "bank_transfer", label: "계좌이체", shortLabel: "계좌이체", payMethod: "BANK_TRANSFER", detail: "현금가 · 입금 확인 후 회원권 발급" },
  { id: "naverpay", label: "네이버페이", shortLabel: "네이버페이", payMethod: "EASY_PAY", detail: "네이버페이 바로 결제" },
  { id: "kakaopay", label: "카카오페이", shortLabel: "카카오페이", payMethod: "EASY_PAY", detail: "카카오페이 바로 결제" },
];

const memberHelpEntries = [
  {
    id: "change-lesson",
    category: "schedule",
    question: "수업 시간을 바꾸고 싶어요",
    answer: "시간표의 ‘시간 바꾸기’에서 기존 수업과 가능한 시간을 선택하세요. 자동 변경 또는 코치 확인 필요 여부가 신청 전에 표시됩니다.",
    action: "schedule",
    actionLabel: "시간표 보기",
  },
  {
    id: "makeup-lesson",
    category: "schedule",
    question: "불참한 수업의 보강은 어떻게 잡나요?",
    answer: "불참 처리로 보강 권리가 생기면 홈과 시간표에 ‘보강 시간 선택’이 표시됩니다. 가능한 시간 한 곳을 고르면 예약됩니다.",
    action: "schedule",
    actionLabel: "보강 시간 보기",
  },
  {
    id: "coupon-booking",
    category: "schedule",
    question: "쿠폰 수업은 어디서 예약하나요?",
    answer: "사용 가능한 쿠폰이 있으면 시간표의 ‘변경·보강·예약’에서 담당 코치의 가능한 시간만 확인할 수 있습니다.",
    action: "schedule",
    actionLabel: "쿠폰 시간 보기",
  },
  {
    id: "multiple-tickets",
    category: "ticket",
    question: "회원권이 두 개 이상이면 어떻게 보이나요?",
    answer: "회원권 화면에 상품과 담당 코치별로 각각 표시됩니다. 수업을 예약하거나 완료할 때 연결된 회원권에서만 횟수가 차감됩니다.",
    action: "shop",
    actionLabel: "회원권 보기",
  },
  {
    id: "pending-payment",
    category: "ticket",
    question: "결제했는데 결제 확인 중으로 나와요",
    answer: "결제 검증과 회원권 발급이 끝나면 자동으로 바뀝니다. 잠시 뒤 회원권 화면에서 다시 확인하고 계속되면 카카오로 문의해 주세요.",
    action: "shop",
    actionLabel: "결제 상태 보기",
  },
  {
    id: "cancel-refund",
    category: "ticket",
    question: "결제 취소나 환불은 어떻게 하나요?",
    answer: "이미 사용한 횟수와 환불 규칙을 확인해야 하므로 카카오 문의에서 회원 이름과 결제일을 알려주세요.",
    action: "support",
    actionLabel: "카카오 문의",
  },
  {
    id: "notifications",
    category: "app",
    question: "수업과 피드백 알림을 받고 싶어요",
    answer: "내 정보의 앱 알림에서 알림을 켜세요. 휴대전화 설정에서 테니스노트 알림도 허용되어 있어야 합니다.",
    action: "notification",
    actionLabel: "알림 설정 보기",
  },
  {
    id: "latest-version",
    category: "app",
    question: "화면이 다른 사람과 다르거나 업데이트가 안 돼요",
    answer: "내 정보의 앱 새로고침을 누르면 로그인은 유지한 채 최신 화면을 다시 확인합니다.",
    action: "refresh",
    actionLabel: "앱 새로고침",
  },
];
