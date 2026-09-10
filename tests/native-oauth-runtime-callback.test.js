import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import vm from "node:vm";

const source = readFileSync(new URL("../app/shared/tennisnote-data-client.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const callback = (environment) => `https://tennisnote-app${environment === "development" ? "-dev" : ""}.pages.dev/native-oauth-callback.html`;
function harness(config, { native = true, coach = false, stored = {} } = {}) {
  const storage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const localStorage = storage(), sessionStorage = storage();
  localStorage.setItem("tennis-note-supabase-config", JSON.stringify(stored));
  const calls = { open: [], network: 0 };
  const window = {
    TENNISNOTE_CONFIG: { supabaseUrl: "https://fixture.example", supabasePublishableKey: "synthetic-client", ...config },
    localStorage, sessionStorage, crypto: webcrypto,
    location: { origin: "https://tennisnote-app.pages.dev", pathname: coach ? "/tennis-note-coach-app/index.html" : "/tennis-note-member-app/index.html", search: "", href: "" },
    dispatchEvent: () => true, setTimeout: () => 1, clearTimeout: () => {},
    Capacitor: { isNativePlatform: () => native, getPlatform: () => native ? "android" : "web", Plugins: {
      App: { addListener: () => {}, getLaunchUrl: async () => ({}) },
      Browser: { addListener: () => {}, open: async (o) => { calls.open.push(o); } },
    } },
  };
  vm.runInNewContext(source, { window, localStorage, sessionStorage, URL, URLSearchParams, TextEncoder, Uint8Array,
    navigator: { onLine: true }, CustomEvent: class {},
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    fetch: async () => { calls.network++; throw new Error("unexpected_auth_network"); },
  });
  return { client: window.TennisNoteDataClient, window, calls };
}

test("private #425 callback 함수 exact parity를 유지한다", () => {
  const fn = source.slice(source.indexOf("  function nativeOAuthBridgeRedirect()"), source.indexOf("  function emailAuthRedirect("));
  assert.equal(createHash("sha256").update(fn).digest("hex"), "a90fb0e686d6adf13feb1c33d2acede2b06459dab18e91575f0fed335cbbe92e");
  assert.match(source, /nativeOAuthCallbackUrl: supabase\.nativeOAuthCallbackUrl \|\| source\?\.nativeOAuthCallbackUrl \|\| ""/);
  assert.match(source, /nativeOAuthCallbackUrl: fileConfig\.nativeOAuthCallbackUrl/);
});

for (const environment of ["production", "development"]) {
  for (const provider of ["naver", "kakao", "apple"]) {
    test(`${environment}/${provider} native exact callback과 기존 provider를 보존한다`, async () => {
      const h = harness({ environment, nativeOAuthCallbackUrl: callback(environment) });
      await h.client.signInWithOAuth(provider);
      assert.equal(h.calls.open.length, 1);
      assert.equal(h.calls.network, 0);
      const q = new URL(h.calls.open[0].url).searchParams;
      assert.equal(q.get("redirect_to"), `${callback(environment)}?target=member`);
      assert.equal(q.get("provider"), provider === "apple" ? "apple" : `custom:${provider}`);
    });
  }
}
const invalid = [
  [{ environment: "production" }, "native_oauth_callback_unconfigured"],
  [{ nativeOAuthCallbackUrl: callback("production") }, "native_oauth_callback_unconfigured"],
  [{ environment: "other", nativeOAuthCallbackUrl: callback("production") }, "native_oauth_callback_unconfigured"],
  [{ environment: "production", nativeOAuthCallbackUrl: callback("development") }, "native_oauth_callback_environment_mismatch"],
  [{ environment: "development", nativeOAuthCallbackUrl: callback("production") }, "native_oauth_callback_environment_mismatch"],
  ...["javascript:void(0)", "http://tennisnote-app.pages.dev/native-oauth-callback.html", "https://tennisnote-app.pages.dev/other", `${callback("production")}?extra=1`, `${callback("production")}#extra`, "https://user@tennisnote-app.pages.dev/native-oauth-callback.html"].map((url) => [{ environment: "production", nativeOAuthCallbackUrl: url }, "native_oauth_callback_environment_mismatch"]),
  [{ environment: "production", nativeOAuthCallbackUrl: "not-a-url" }, "native_oauth_callback_invalid"],
];
invalid.forEach(([config, code], index) => test(`native 부적합 설정 ${index + 1}: Browser/Auth network 0`, async () => {
  const h = harness(config);
  await assert.rejects(h.client.signInWithOAuth("naver"), (e) => e.code === code);
  assert.equal(h.calls.open.length, 0);
  assert.equal(h.calls.network, 0);
}));

test("저장된 callback은 파일의 환경 계약을 덮어쓰지 못한다", async () => {
  const h = harness({ environment: "production", nativeOAuthCallbackUrl: callback("production") }, { coach: true, stored: { environment: "development", nativeOAuthCallbackUrl: callback("development") } });
  await h.client.signInWithOAuth("naver");
  assert.equal(new URL(h.calls.open[0].url).searchParams.get("redirect_to"), `${callback("production")}?target=coach`);
});
test("중첩 설정의 명시 callback을 보존한다", () => {
  const h = harness({ supabase: { environment: "production", nativeOAuthCallbackUrl: callback("production") } });
  assert.equal(h.client.loadConfig().nativeOAuthCallbackUrl, callback("production"));
});
test("PWA는 native callback 없이도 기존 웹 복귀를 사용한다", async () => {
  const h = harness({}, { native: false });
  await h.client.signInWithOAuth("naver");
  assert.equal(h.calls.open.length, 0);
  assert.equal(h.calls.network, 0);
  assert.equal(new URL(h.window.location.href).searchParams.get("redirect_to"), "https://tennisnote-app.pages.dev/tennis-note-member-app/index.html");
});
