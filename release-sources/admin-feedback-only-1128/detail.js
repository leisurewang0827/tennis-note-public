  function detailedDraft(value, context = {}) {
    const base = generate(value, context);
    if (!base.ok) return base;
    const hold = () => ({ok:false,code:"feedback_detail_required",message:"오늘 관찰한 동작과 특징을 회원별로 한 줄 더 적어 주세요.",keywords:[],sections:[],comment:""});
    // Only scan a normalized copy, never change a participant's observation.
    const labels = String(value).normalize("NFKC").replace(/[\u200B-\u200D\u2060\uFEFF]/gu,"");
    if (/(?:^|[^\p{L}\p{M}\p{N}])(?:공통|회원\s*[가나다AB12]|[AB])\s*:/iu.test(labels) ||
        /다음\s*(?:레슨|수업|연습)|[?？]/u.test(value)) return hold();
    const facts = base.keywords.join(" · ");
    const options = [
      [/복귀|제자리로\s*돌아/u,"안전한 곳에 기준점을 정해 두세요. 옆으로 이동해 빈 스윙을 한 뒤 기준점으로 돌아와 준비 자세를 잡아 보세요."],
      [/타점.{0,12}몸.{0,5}가까|몸.{0,5}가까.{0,10}타점/u,"공을 몸 앞쪽에 떨어뜨려 가볍게 쳐 보세요. 공이 라켓에 닿을 때 몸과 팔 사이에 공간이 남는지 살펴보세요."],
      [/타점.{0,12}(?:뒤|밀)|준비.{0,5}늦/u,"공 없이 어깨를 돌려 먼저 준비하고, 몸 앞에서 공을 만나는 위치에 라켓을 잠깐 멈춰 보세요."],
      [/타점|임팩트/u,"공을 바닥에 튀긴 뒤 가볍게 쳐 보세요. 라켓에 닿는 순간 공과 몸 사이 거리를 확인하세요."],
      [/테이크백|준비/u,"공 없이 준비 자세에서 어깨를 돌려 보세요. 앞으로 스윙하기 전에 라켓이 준비됐는지 확인하세요."],
      [/발리/u,"라켓을 몸 앞에 들고 공 없이 짧게 밀어 보세요. 라켓이 어깨 뒤로 넘어가지 않는지 살펴보세요."],
      [/포핸드|백핸드|라켓\s*면|스윙/u,"빈 스윙을 하다가 공을 맞힐 위치에서 멈춰 보세요. 라켓 면이 어디를 향하는지 확인하세요."],
      [/스텝|풋워크|균형/u,"안전한 공간에서 옆으로 이동했다가 멈춰 보세요. 멈췄을 때 중심이 한쪽으로 쏠리는지 확인하세요."],
      [/서브|토스/u,"라켓을 내려놓고 토스 동작만 해 보세요. 공이 어느 위치에 떨어지는지 확인하세요."]
    ];
    const practice = options.find(([pattern]) => pattern.test(facts));
    if (!practice) return hold();
    const sections = [{label:"오늘 관찰",text:base.comment},{label:"개인 연습",text:practice[1]}];
    const comment = sections.map(s => s.label+"\n"+s.text).join("\n\n");
    if (comment.length>500) return hold();
    return {...base,sections,comment,quality:{...base.quality,visibleLength:feedbackVisibleLength(comment)}};
  }
