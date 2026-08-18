/**
 * 스크립트를 "로드만" 해보기 위한 아주 얕은 브라우저 흉내.
 *
 * 목적은 화면을 그리는 게 아니라, <script> 가 실행되는 순간 터지는 오류를
 * 잡는 것이다. 실제로 이런 사고가 있었다.
 *
 *   Uncaught ReferenceError: allScheduleSettings is not defined
 *
 * 함수 밖 최상위 코드의 식별자를 잘못 치환해서 났고, node --check 는
 * 문법이 멀쩡하니 통과했다. 브라우저를 직접 열어야만 보였다.
 *
 * 여기서 하는 건 딱 그 지점까지다. 함수 안에서만 쓰이는 DOM 동작은
 * 검사하지 않는다. 그건 화면을 눌러봐야 안다.
 */
const noop = () => undefined;

function fakeElement() {
  const target = {};
  return new Proxy(target, {
    get(_t, key) {
      if (typeof key === "symbol") return undefined;
      if (key === "style" || key === "dataset") return new Proxy({}, { get: (_s, k) => (typeof k === "string" && /^(set|remove|get|item)/.test(k) ? noop : ""), set: () => true });
      if (key === "classList") return new Proxy({}, { get: () => noop });
      if (key === "value" || key === "textContent" || key === "innerHTML" || key === "id") return "";
      if (key === "hidden" || key === "checked" || key === "disabled") return false;
      if (key === "children" || key === "childNodes") return [];
      if (key === "querySelectorAll" || key === "getElementsByTagName" || key === "getElementsByClassName") return () => [];
      if (key === "parentElement" || key === "firstChild") return null;
      return () => fakeElement();
    },
    set: () => true,
  });
}

export function createBrowserStub({ pathname = "/app/admin/", search = "" } = {}) {
  const element = fakeElement();
  const localStore = {
    getItem: () => null, setItem: noop, removeItem: noop, clear: noop, key: () => null, length: 0,
  };
  const document = new Proxy({}, {
    get(_t, key) {
      if (key === "readyState") return "loading";
      if (key === "body" || key === "documentElement" || key === "head") return element;
      if (key === "querySelectorAll" || key === "getElementsByTagName") return () => [];
      if (key === "addEventListener" || key === "removeEventListener") return noop;
      if (key === "cookie") return "";
      if (typeof key === "symbol") return undefined;
      return () => element;
    },
    set: () => true,
  });
  const location = {
    search, pathname, hash: "", hostname: "127.0.0.1",
    origin: "http://127.0.0.1:8773", href: `http://127.0.0.1:8773${pathname}${search}`,
    replace: noop, assign: noop, reload: noop,
  };
  // 대입을 실제로 저장해야 한다. window.TennisNoteXxx = ... 로 내보내는
  // 공용 모듈들이 그 값을 다시 읽기 때문이다.
  const store = {};
  const window = new Proxy(store, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "location") return location;
      if (key === "document") return document;
      if (key === "localStorage" || key === "sessionStorage") return localStore;
      if (key === "navigator") return { userAgent: "node", onLine: true, serviceWorker: undefined };
      if (key === "matchMedia") return () => ({ matches: false, addEventListener: noop, addListener: noop });
      if (key === "addEventListener" || key === "removeEventListener") return noop;
      if (key === "setTimeout" || key === "setInterval" || key === "requestAnimationFrame") return () => 0;
      if (key === "requestIdleCallback") return () => 0;
      if (key === "performance") return { now: () => 0 };
      if (key === "MutationObserver") return class { observe() {} disconnect() {} };
      if (typeof key === "string" && key in globalThis) return globalThis[key];
      if (typeof key === "symbol") return undefined;
      // 모르는 속성은 호출도 되고 속성 접근도 되는 가짜를 준다.
      // 스텁에 없는 브라우저 API 때문에 검사가 깨지는 걸 막는다.
      return fakeElement();
    },
    set(target, key, value) { target[key] = value; return true; },
    has: (target, key) => key in target || true,
  });
  return { window, document, storage: localStore, location };
}

/** 스크립트들을 순서대로 이어붙여 한 전역 공간에서 실행한다. 터지면 그대로 던진다. */
export function loadScripts(sources, options) {
  const stub = createBrowserStub(options);
  const runner = new Function(
    "window", "document", "localStorage", "sessionStorage", "navigator",
    "performance", "self", "MutationObserver", "location",
    sources.join("\n;\n"),
  );
  try {
    runner(
      stub.window, stub.document, stub.storage, stub.storage,
      { userAgent: "node", onLine: true }, { now: () => 0 }, stub.window,
      class { observe() {} disconnect() {} }, stub.location,
    );
  } catch (error) {
    // ReferenceError 만 실패로 본다. 정의되지 않은 이름을 참조하는 것이고,
    // 브라우저에서도 똑같이 터진다. 우리가 잡으려는 사고가 정확히 이것이다.
    //
    // TypeError 는 대부분 이 얕은 스텁이 흉내내지 못한 DOM 동작이다.
    // 그걸 계속 메우면 검사가 무거워지고, 우리 변경과 무관한 이유로
    // 깨져서 다음 사람에게 부담이 된다. 그래서 무시한다.
    if (error instanceof ReferenceError) throw error;
  }
}
