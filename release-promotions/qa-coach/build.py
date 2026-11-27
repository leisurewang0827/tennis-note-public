"""Add one gated DEV route, leaving all shipped product files except the Pages router untouched."""
import concurrent.futures, hashlib, json, os, re, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PARENT = "4cb4538af11ffa2b9ec842eeacd81b948cc615f4"
BASE_ID = "f7ba133d-66b7-4dfb-bff9-f571c8a76bf7"
SITE = "tennisnote-app-dev.pages.dev"
BRANCH = "codex/dev-single-coach-entry-20261127"
FLOW = ".github/workflows/qa-single-coach-seoul-dev.yml"
PREFIX = "release-promotions/qa-coach/"
FILES = {FLOW} | {PREFIX+n for n in ("build.py","publish.py","page.html","entry.js","tags.json","test.py","test.mjs")}
SEALED = Path(os.environ.get("TN_SEALED_LIB", str(HERE.parent/"coach-schedule-dev")))
sys.path.insert(0,str(SEALED))
import artifact as old
need, sha = old.need, old.sha
CLIENT = "shared/tennisnote-data-client.js"
CSP = ("default-src 'none'; script-src 'self'; connect-src https://udjmiezroipctytmztwz.supabase.co/auth/v1/token "
       "https://udjmiezroipctytmztwz.supabase.co/rest/v1/rpc/tn_dev_normal_coach_work; frame-ancestors 'none'; "
       "form-action 'none'; base-uri 'none'; worker-src 'none'; object-src 'none'")

def one(s, a, b):
    need(s.count(a)==1,"client source boundary"); return s.replace(a,b,1)

def make_client(raw, tags):
    need(sha(raw)=="4c9cbedc91e1593be5fb9fc7c3661541e46854f8ac616fd81adfa053d4a25a07","not frozen auth client")
    need(set(tags)=={"mail","scope"} and all(re.fullmatch("[0-9a-f]{64}",v) for v in tags.values()),"invalid one-account tags")
    s=raw.decode()
    start=s.index("  async function signInWithPassword("); end=s.index("  async function signUpWithPassword(",start)
    fn=s[start:end]
    fn=one(fn, 'const config = loadConfig();','await qaBeforeAuth(normalizedEmail);\n    const config = loadConfig();')
    fn=one(fn, 'method: "POST",','method: "POST", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error",')
    i=fn.index("    if (!response.ok)"); j=fn.index("    return saveSession(",i)
    fn=fn[:i]+'    if (!response.ok) throw Error("login");\n    await qaBeforeSave(payload, normalizedEmail);\n'+fn[j:]
    s=s[:start]+fn+s[end:]
    # No exported client, bootstrap/telemetry, native observers or existing app listeners on this page.
    end=s.index("  recordAuthSessionStartup();\n\n  window.TennisNoteDataClient =")
    entry=(HERE/"entry.js").read_text("utf8")
    for k,v in tags.items(): entry=one(entry,"__"+k.upper()+"_TAG__",v)
    return (s[:end]+entry+"\n})();\n").encode()

def router(base, client):
    html=(HERE/"page.html").read_text("utf8")
    block="""
    const url=new URL(request.url);
    if (url.pathname.startsWith("/qa-coach-login")) {
      const h={"Cache-Control":"private, no-store","Content-Security-Policy":CSP_VALUE,"Referrer-Policy":"no-referrer",
        "X-Frame-Options":"DENY","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow"};
      const html=url.pathname==="/qa-coach-login", js=url.pathname==="/qa-coach-login-client.js";
      if (url.origin!=="https://tennisnote-app-dev.pages.dev" || url.search || !(html||js) || request.method!=="GET")
        return new Response(null,{status:404,headers:h});
      h["Content-Type"]=html?"text/html; charset=utf-8":"application/javascript; charset=utf-8";
      return new Response(html?PAGE_VALUE:CLIENT_VALUE,{headers:h});
    }
"""
    block=block.replace("CSP_VALUE",json.dumps(CSP)).replace("PAGE_VALUE",json.dumps(html)).replace("CLIENT_VALUE",json.dumps(client.decode()))
    anchor="  async fetch(request, env) {"
    return one(base.decode(),anchor,anchor+block).encode()

def baseline():
    m=old.policy(); return m,m["files"]|m["delta"]

def assemble(root):
    need(not root.exists(),"output already exists")
    m,files=baseline(); root.mkdir(parents=True)
    def copy(p):
        b=m["control"][p].encode() if p in old.CONTROLS else old.public_bytes(BASE_ID[:8]+"."+SITE,p,files[p])
        need(sha(b)==files[p],"base bytes"); out=root/p;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(b)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: list(pool.map(copy,files))
    tag=json.loads((HERE/"tags.json").read_bytes())
    (root/"_worker.js").write_bytes(router((root/"_worker.js").read_bytes(),make_client((root/CLIENT).read_bytes(),tag)))
    return verify(root)

def verify(root):
    m,files=baseline()
    code=make_client((root/CLIENT).read_bytes(),json.loads((HERE/"tags.json").read_bytes()))
    expected=files|{"_worker.js":sha(router(m["control"]["_worker.js"].encode(),code))}
    paths={p.relative_to(root).as_posix():sha(p.read_bytes()) for p in root.rglob("*") if p.is_file()}
    need(expected==paths and sum(expected[p]!=files[p] for p in files)==1,"sealed scope mismatch")
    return sha(json.dumps(sorted(paths.items()),separators=(",",":")).encode())

if __name__=="__main__":
    seal=assemble(Path("sealed-app"))
    print("254 DEV assets; isolated login router only; unchanged 253; seal",seal,flush=True)
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"],"a") as f: print("seal="+seal,file=f)
