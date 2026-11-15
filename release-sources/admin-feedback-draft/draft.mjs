// Local review overlay: pinned source inputs, no writes or network access.
import assert from 'node:assert/strict';

const pins={
  'app/shared/tennisnote-comment-draft.js':'a795520949522015815b7cae650c154fe910cbce43ede91cee1b167c4751e141',
  'app/admin/actions/common.js':'b6ae4f530368777788b4abe313719a3037a859de8c7b23a0b486b4bc729d36a5',
  'app/admin/schedule-v2-admin.js':'e074cebb29c328272319f4282428b57d79e39ccce6d7e74f5ae73b883a5367fb',
};

function detailedDraft(value, context = {}) {
  const base = generate(value, context);
  if (!base.ok) return base;
  const keys = base.keywords;
  const positive = /(?:좋아|안정|개선|나아|성공|일정해|유지됨|잘 됨|잘됨)/u;
  const needs = /(?:늦|밀림|밀렸|흔들|부족|놓치|놓침|어려|짧음|짧았|열림|열렸)/u;
  const uncertain = /(?:않|못|없|아님|아니|싶|되면|하면|필요|수업 전|다음번|다음 수업|목표|예정|할 것)/u;
  const question = /[?？]/u.test(String(value || ''));
  const strengths = keys.filter((item) => !question && positive.test(item) && !needs.test(item) && !uncertain.test(item));
  const practice = keys.filter((item) => !question && needs.test(item) && !positive.test(item) && !uncertain.test(item));
  const other = keys.filter((item) => !strengths.includes(item) && !practice.includes(item));
  const compare = (facts) => facts.map(quoted).join(' · ');
  const blocks = [];
  if (strengths.length) blocks.push({label:'잘된 점', text:`코치가 남긴 관찰 중 ${compare(strengths)} 부분은 다음 연습에서도 같은 동작으로 재현해 보세요.`});
  if (practice.length) blocks.push({label:'더 연습할 점', text:`${compare(practice)} 부분은 속도를 낮추고 어떤 순간부터 동작이 달라지는지 한 가지씩 확인해 보세요.`});
  if (other.length) blocks.push({label:'수업 메모', text:`코치가 입력한 키워드: ${compare(other)}.`});

  // Suggestions are labeled; they never claim the member did these drills.
  // Match only the coaching points actually provided in the notes.
  const drills = [
    [/준비|테이크백|스플릿/u, '공 없이 시작 자세를 잡고, 공을 친다고 생각한 뒤 실제 스윙 전에 준비 자세가 끝나는지 확인해 보세요.'],
    [/타점|임팩트/u, '느린 공으로 타점에 맞춰 스윙한 뒤, 공을 만난 위치가 반복할 때마다 비슷한지 확인해 보세요.'],
    [/라켓\s*면|라켓\s*각도/u, '공을 천천히 보내면서 공을 맞히는 순간의 라켓 면과 실제 공의 방향을 함께 확인해 보세요.'],
    [/스텝|풋워크|균형/u, '공 없이 이동하고 멈추는 동작을 먼저 연습한 뒤, 멈췄을 때 중심이 한쪽으로 쏠리는지 확인해 보세요.'],
    [/방향|코스/u, '타구 속도보다 목표 구역을 먼저 정하고, 비슷한 속도로 보낸 공이 목표 근처에 모이는지 확인해 보세요.'],
    [/리듬|스윙/u, '편한 속도로 스윙을 반복하고, 준비부터 마무리까지 중간에 동작이 끊기는 구간이 있는지 살펴보세요.'],
    [/포핸드|백핸드|서브|발리/u, '힘을 먼저 올리기보다 편한 속도로 동작을 반복해 보세요. 매번 비슷한 준비 자세로 시작하는지 한 가지 기준을 정해 확인해 보세요.'],
  ];
  const priority = [...practice, ...strengths, ...other];
  const drill = question ? null : priority.map((fact) => drills.find(([pattern]) => pattern.test(fact))).find(Boolean);
  if (drill) blocks.push({label:'개인 연습 제안', text:drill[1]});
  if (!question && !drill && (practice.length || strengths.length)) {
    blocks.push({label:'개인 연습 제안', text:'동작을 한꺼번에 바꾸기보다 위 메모에서 한 가지를 골라 천천히 반복해 보세요. 다음 수업에서는 어떤 점이 달라졌는지 코치와 함께 확인해 보세요.'});
  }

  const describe = (sections) => sections.map(({label,text}) => `${label}\n${text}`).join('\n\n');
  let comment = describe(blocks);
  if (comment.length > 500 && blocks.at(-1)?.label === '개인 연습 제안') {
    blocks.pop();
    comment = describe(blocks);
  }
  if (!comment || comment.length > 500 || feedbackVisibleLength(comment) < minimumVisibleFeedbackLength ||
      !keys.every((key) => comment.includes(key))) return base;
  return {...base, comment, sections:blocks, quality:{...base.quality, visibleLength:feedbackVisibleLength(comment),
    sentenceCount:blocks.reduce((count,block) => count + (block.text.match(/[.!?](?=\s|$)/gu)||[]).length,0)}};
}

export function patchAdminDraftSource(path,text) {
  const replace=(text,from,to)=>{
    assert.equal(text.split(from).length,2,'exact overlay anchor');
    return text.replace(from,()=>to);
  };
  assert.ok(Object.hasOwn(pins,path));
  const crlf=text.includes('\r\n');
  if(crlf)assert.ok(!/(?<!\r)\n/u.test(text),'mixed source newlines');
  let source=text.replace(/\r\n/g,'\n');
    if(path.includes('/shared/')) {
      source=replace(source,'  window.TennisNoteCommentDraft =',`  ${detailedDraft.toString().replace(/\n/g,'\n  ')}\n\n  window.TennisNoteCommentDraft =`);
      source=replace(source,'    generateSectioned,','    generateSectioned,\n    generateDetailed: detailedDraft,');
    } else if(path.endsWith('/common.js')) {
      source=replace(source,'const result = generator.generate(keywordInput.value);','const result = (generator.generateDetailed || generator.generate)(keywordInput.value);');
    } else {
      source=replace(source,'const draft = generator.generate(keywordInput.value, { curriculum: selectedCurriculum });','const draft = (generator.generateDetailed || generator.generate)(keywordInput.value, { curriculum: selectedCurriculum });');
    }
  return crlf?source.replace(/\n/g,'\r\n'):source;
}
