"""Build and read back the exact nonfinancial Seoul development app. No credentials."""
import concurrent.futures
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path, PurePosixPath

PAGES = "tennisnote-app-dev.pages.dev"
PROJECT = "tennisnote-app-dev"
OLD = "035ade34-d322-42f0-8b17-5c66b57dd59d"
BASE = "ca5528d3b7b8cd1b9ef41c4cefd7122d9671af57"
FEATURE = "5d69178400e747539438c559c861f0652f2db80d"
POLICY = "60fed24a7b604b9c7a17801627c200835b2125951db0f006ec4a5aa0c95ed2a3"
CHANGE = {"tennis-note-coach-app/" + x for x in
          ("actions/schedule.js", "views/schedule.js", "events/delegated.js")}
CONTROLS = {"_worker.js", "_headers", "_redirects"}


def need(ok, why):
    if not ok:
        raise ValueError(why)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def policy():
    raw = Path(__file__).with_name("manifest.json").read_bytes()
    need(sha(raw) == POLICY, "policy digest")
    m = json.loads(raw)
    need(len(m["files"]) == 254 and set(m["delta"]) == CHANGE and
         set(m["control"]) == CONTROLS and set(CONTROLS | CHANGE) <= set(m["files"]), "policy scope")
    need(all(p == str(PurePosixPath(p)) and re.fullmatch(r"[a-zA-Z0-9._/-]+", p)
             and not p.startswith("/") and ".." not in p.split("/")
             and re.fullmatch("[a-f0-9]{64}", h) for p,h in m["files"].items()), "unsafe manifest")
    need(all(m["files"][p] != m["delta"][p] for p in CHANGE), "delta does not change all three")
    return m


def origin(host):
    need(host == PAGES or re.fullmatch("[0-9a-f]{8}\\."+re.escape(PAGES), host), "not exact dev app")
    return "https://" + host


def route(p):
    if p == "index.html" or p.endswith("/index.html"):
        return "/" + p[:-10]
    return "/" + (p[:-5] if p.endswith(".html") else p)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


class DigestMismatch(ValueError):
    def __init__(self, path, actual):
        super().__init__("served digest mismatch: "+path)
        self.path,self.actual=path,actual


def public_bytes(host, p, digest, fresh=False):
    req = urllib.request.Request(origin(host) + route(p) + ("?tn_sealed_read=1" if fresh else ""), headers={"Accept-Encoding":"identity",
                                "Cache-Control":"no-cache","User-Agent":"TennisNote-dev-artifact-check/1"})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=25) as r:
            b = r.read(12 * 1024 * 1024 + 1)
            need(r.status == 200 and len(b) <= 12 * 1024 * 1024, "invalid public asset: "+p)
    except urllib.error.HTTPError as e:
        raise ValueError(f"public asset HTTP {e.code}: {p}") from None
    if sha(b)!=digest: raise DigestMismatch(p,sha(b))
    return b


def verify_tree(root, m):
    paths = {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()}
    need(paths == set(m["files"]) and not any(p.is_symlink() for p in root.rglob("*")), "unexpected file set")
    for p,h in (m["files"] | m["delta"]).items():
        need(sha((root/p).read_bytes()) == h, "candidate digest: " + p)
    config = (root/"shared/config.local.js").read_text(encoding="utf8")
    def config_object(key):
        return json.loads(re.search(re.escape("window."+key)+r"\s*=\s*(\{[\s\S]*?\});",config)[1])
    c,pay = config_object("TENNISNOTE_CONFIG"),config_object("TENNIS_NOTE_PAYMENT_CONFIG")
    need(c["environment"] == "development" and c["projectFingerprint"] == "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba"
         and pay["enabled"] is False and pay["mode"] == "disabled", "dev runtime/payment lock")
    rel = json.loads((root/"release.json").read_bytes())
    need((rel["version"],rel["releaseId"]) == ("1.0.583","2026.11.05.07"), "release lock")
    att=sha(json.dumps(sorted((p,sha((root/p).read_bytes())) for p in paths),separators=(",",":")).encode())
    print("sealed development member/coach app: 254 verified; 3 changed, 251 preserved; seal "+att,flush=True)
    return att


def assemble(root, repo, retained=None):
    m = policy()
    need(not root.exists(), "destination already exists")
    root.mkdir(parents=True)
    def one(item):
        p,h = item
        if retained is not None:
            b = (retained/p).read_bytes()
        elif p in CONTROLS:
            b = m["control"][p].encode()
        else:
            b = public_bytes(OLD[:8]+"."+PAGES, p, h)
        need(sha(b) == h, "base digest: "+p)
        if p in CHANGE:
            b = subprocess.check_output(["git","-C",str(repo),"show",FEATURE+":app/"+p])
            need(sha(b) == m["delta"][p], "reviewed source mismatch: "+p)
        out=root/p
        out.parent.mkdir(exist_ok=True,parents=True)
        out.write_bytes(b)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        list(pool.map(one,m["files"].items()))
    verify_tree(root,m)


def served(host, candidate=True):
    origin(host)
    m=policy()
    files = m["files"] | (m["delta"] if candidate else {})
    def one(p):
        public_bytes(host,p,files[p])
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        list(pool.map(one,sorted(set(files)-CONTROLS)))
    print("251 public responses match; 3 Pages control files checked at assembly",flush=True)


if __name__ == "__main__":
    if sys.argv[1:] == ["source"]:
        served(OLD[:8]+"."+PAGES,False)
    elif sys.argv[1:] == ["assemble"]:
        assemble(Path("sealed-app"),Path.cwd())
    elif sys.argv[1:] == ["verify"]:
        verify_tree(Path("sealed-app"),policy())
    elif sys.argv[1:]==["attest"]:
        att=verify_tree(Path("sealed-app"),policy())
        with open(os.environ["GITHUB_OUTPUT"],"a",encoding="utf8") as out:
            print("seal="+att,file=out)
    elif sys.argv[1:]==["admit"]:
        need(verify_tree(Path("sealed-app"),policy())==os.environ["UPSTREAM_SEAL"],"independent verified artifact mismatch")
    else:
        raise SystemExit("expected source, assemble or verify")
