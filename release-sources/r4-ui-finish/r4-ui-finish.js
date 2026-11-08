/* R4 UI 표현만 보완한다. 입력·서버 호출·권한 상태는 기존 코드가 소유한다. */
(function (root, document) {
  "use strict";
  const prepare = () => {
    const form = document.getElementById("r4FirstLessonSetup");
    if (form && !form.dataset.r4UiFinish) {
      const intro = form.querySelector("p");
      const submit = form.querySelector('button[type="submit"]');
      if (intro && submit && ["coachName", "productName", "memberName"].every(name => form.elements.namedItem(name))) {
        intro.textContent = "코치·상품·회원을 등록합니다. 수업은 이후에 배정하세요.";
        const details = document.createElement("p");
        details.textContent = "기본 상품은 0원·20분 정규 5회권입니다.";
        const notice = document.createElement("p");
        notice.textContent = "결제나 코치 계정 연결은 하지 않습니다.";
        intro.after(details, notice);
        submit.textContent = "기본 정보 등록";
        form.setAttribute("aria-label", "기본 정보 등록");
        for (const [name, label] of [["coachName", "코치 이름 "], ["productName", "상품 이름 "], ["memberName", "회원 이름 "]]) {
          const wrapper = form.elements.namedItem(name).closest("label");
          const text = wrapper && [...wrapper.childNodes].find(node => node.nodeType === 3);
          if (text) text.nodeValue = label;
        }
        form.dataset.r4UiFinish = "ready";
      }
    }
    const screen = document.getElementById("r4ScopedCoachApp");
    const tabs = screen?.querySelector("nav.tabbar");
    if (!tabs || tabs.dataset.r4UiFinish) return;
    const buttons = [...tabs.querySelectorAll("button")];
    if (buttons.length !== 3 || buttons.map(button => button.textContent.trim()).join("|") !== "오늘|레슨표|내 정보") return;
    const select = chosen => {
      for (const button of buttons) {
        if (button === chosen) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    };
    buttons.forEach(button => button.addEventListener("click", () => select(button)));
    select(buttons[0]);
    tabs.dataset.r4UiFinish = "ready";
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", prepare, { once: true });
  else prepare();
  new MutationObserver(prepare).observe(document.documentElement, { childList: true, subtree: true });
})(window, document);
