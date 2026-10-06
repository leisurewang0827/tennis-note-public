"use strict";
// 값/선택자/오류문구를 읽지 않고 합성 helper의 호출 위치만 보존한다.
const helper = "tennisnote_single_sheet_initial_ui_cases.cjs";
function callsites(stack) {
  return String(stack || "").split("\n").filter(line => line.includes(helper + ":"))
    .map(line => line.match(/:(\d+):(\d+)\)?$/)).filter(Boolean).slice(0, 4)
    .map(match => ({ file: helper, line: Number(match[1]), column: Number(match[2]) }));
}
function traceApi(target, notify) {
  const cache = new WeakMap();
  const methods = new Set(["evaluate", "goto", "waitForFunction", "waitFor", "click", "setInputFiles", "innerText", "isVisible", "isEnabled", "isDisabled", "isHidden", "getAttribute", "setViewportSize", "emulateMedia", "scrollIntoViewIfNeeded", "goBack", "screenshot"]);
  const wrap = api => {
    if (cache.has(api)) return cache.get(api);
    const proxy = new Proxy(api, { get(object, name) {
      const value = Reflect.get(object, name, object);
      if (typeof value !== "function") return value;
      return (...args) => {
        if (methods.has(name)) notify({ method: name.toUpperCase(), callsites: callsites(new Error().stack) });
        const result = Reflect.apply(value, object, args);
        return ["locator", "first", "last", "nth", "filter"].includes(name) ? wrap(result) : result;
      };
    } });
    cache.set(api, proxy); return proxy;
  };
  return wrap(target);
}
function failureRecord(step, error, state) {
  const names = ["Error", "TimeoutError", "TypeError", "RangeError", "ReferenceError", "SyntaxError"];
  return { step, errorName: names.includes(error?.name) ? error.name : "OTHER_ERROR", callsites: callsites(error?.stack), state };
}
module.exports = { traceApi, callsites, failureRecord };
