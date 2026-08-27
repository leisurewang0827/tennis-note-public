// 화면에 쓰는 고정 데이터 표.
//
// 전부 리터럴이다. 계산도 호출도 없다. 문구나 항목을 바꾸려면 여기만 고치면 된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 선언이라 쓰는 쪽은 예전과 같다.

const legacyCurriculumSteps = [
  {
    id: "FH-01",
    title: "포핸드 연결 안정화",
    level: "초급",
    category: "포핸드",
    focus: "라켓면 고정, 전진 스텝, 짧은 공 처리",
    guide: "다음 수업은 짧은 공 접근 후 크로스 방향 컨트롤을 진행합니다.",
    checklist: "라켓면이 흔들리는지, 전진 스텝 후 몸이 열리는지 확인",
    mission: "짧은 공 10구 중 6구 이상 안정적으로 넘기기",
    notionSource: "Notion · 입문/초급 포핸드 DB",
    notionUrl: "https://app.notion.com/p/305b107df4808096a7f9f2a1776487ed",
  },
  {
    id: "BH-R1",
    title: "백핸드 리턴 준비",
    level: "입문",
    category: "백핸드",
    focus: "스플릿 스텝, 어깨 회전, 임팩트 전 준비",
    guide: "다음 수업은 백핸드 리턴 타이밍과 낮은 공 처리를 진행합니다.",
    checklist: "스플릿 스텝 후 어깨가 먼저 돌아가는지 확인",
    mission: "느린 리턴 공을 6구 이상 같은 방향으로 연결",
    notionSource: "Notion · 리턴/백핸드 DB",
    notionUrl: "https://app.notion.com/p/317b107df48080b6a6f4fc1c42348dd8",
  },
  {
    id: "SV-01",
    title: "서브 기본 루틴",
    level: "입문",
    category: "서브",
    focus: "토스 위치, 리듬, 임팩트 후 밸런스",
    guide: "다음 수업은 토스 안정화와 세컨드 서브 루틴을 진행합니다.",
    checklist: "토스 위치, 임팩트 후 밸런스, 마무리 발 위치 확인",
    mission: "토스 10회 중 7회 이상 같은 위치로 올리기",
    notionSource: "Notion · 서브 루틴 DB",
    notionUrl: "https://app.notion.com/p/38ab107df480817188a2e3f84eeb12cf",
  },
];

const defaultCoachNotice = {
  id: "notice-coach-default",
  title: "코치 공지",
  body: "관리자 대시보드에서 등록한 공지가 이곳에 표시됩니다.",
  audience: "coach",
  status: "disabled",
  priority: "normal",
  showOncePerDay: true,
};

const ntrpLevels = ["측정 전", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0"];
