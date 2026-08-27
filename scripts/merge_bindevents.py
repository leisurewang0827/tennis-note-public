#!/usr/bin/env python3
"""bindEvents 를 우리 events/ 로 다시 가른다. 세 단계를 한 파일에 뒀다.

  restore  app.js 의 bindEvents 를 우리 호출 목록으로 되돌린다
  place    기준점 -> 저쪽 덩어리를 앞 문맥으로 자리 잡아 보여준다
  apply    실제로 넣는다
  diff     우리 events/ 전체가 저쪽 bindEvents 와 같은 줄들인가 (집합 비교)
"""
import difflib, re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent

def sh(*a):
    return subprocess.run(list(a), cwd=ROOT, capture_output=True, text=True).stdout

def span(L, name):
    pat = re.compile(rf"^(\s*)(?:async\s+)?function {name}\s*\(")
    for i, l in enumerate(L):
        m = pat.match(l)
        if m:
            close = m.group(1) + "}"
            for j in range(i+1, len(L)):
                if L[j] == close: return i, j
    return None

def body(ref, app):
    L = sh("git","show",f"{ref}:{app}/app.js").split("\n")
    s = span(L, "bindEvents")
    return L[s[0]+1:s[1]] if s else []

def ours_lines(app):
    out = []
    for p in sorted((ROOT/app/"events").glob("*.js")):
        L = p.read_text(encoding="utf-8").split("\n")
        for m in re.finditer(r"^(?:async\s+)?function (bind[A-Za-z0-9_$]*Events)\s*\(", "\n".join(L), re.M):
            s = span(L, m.group(1))
            if s: out.extend(L[s[0]+1:s[1]])
    return out

def find(texts, ctx):
    hits = []
    for p, L in texts.items():
        S = [l.strip() for l in L]
        for k in range(len(S)-len(ctx)+1):
            if S[k:k+len(ctx)] == ctx: hits.append((p, k+len(ctx)))
    return hits

def hunks(app, base):
    a, b = body(base, app), body("origin/main", app)
    return a, b, [o for o in difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes() if o[0]!="equal"]

def plan(app, base, texts):
    a, b, ops = hunks(app, base)
    plans = []
    for tag,i1,i2,j1,j2 in ops:
        remove = [l.strip() for l in a[i1:i2] if l.strip()]
        hit = None
        # 지울 줄이 있으면 그 줄들 자체로 찾는 것이 제일 확실하다.
        # 앞 문맥("});" 같은 것)은 여러 곳에 걸려 엉뚱한 자리를 잡은 적이 있다.
        if remove:
            hits = find(texts, remove)
            if len(hits) == 1:
                p, end = hits[0]
                hit = (p, end - len(remove))
        if hit is None:
            for n in (1,2,3,5,8,12,20,30):
                ctx = [l.strip() for l in a[max(0,i1-n):i1] if l.strip()]
                if not ctx:
                    if i1-n <= 0: sys.exit(f"{app}: 앞 문맥 없음 ({tag} {i1})")
                    continue
                hits = find(texts, ctx)
                if len(hits) == 1:
                    hit = hits[0]; break
                if len(hits) == 0: sys.exit(f"{app}: 문맥 못 찾음 ({tag} {i1}) — {ctx[-1][:60]}")
            else: sys.exit(f"{app}: 문맥이 유일하지 않음 ({tag} {i1})")
        p, at = hit
        if remove:
            got = [l.strip() for l in texts[p][at:at+len(a[i1:i2])] if l.strip()]
            if got[:len(remove)] != remove:
                sys.exit(f"{app}: 지울 줄이 다름\n  예상 {remove}\n  실제 {got}")
        plans.append((p, at, len(a[i1:i2]), b[j1:j2], tag))
    return plans

cmd = sys.argv[1]; apps = sys.argv[2:]
base = sh("git","merge-base","origin/main","HEAD").strip()

if cmd == "restore":
    pre = sys.argv[2]; apps = sys.argv[3:]
    for app in apps:
        p = ROOT/app/"app.js"; cur = p.read_text(encoding="utf-8").split("\n")
        ours = sh("git","show",f"{pre}:{app}/app.js").split("\n")
        ci,cj = span(cur,"bindEvents"); oi,oj = span(ours,"bindEvents")
        before = cj-ci+1; cur[ci:cj+1] = ours[oi:oj+1]
        p.write_text("\n".join(cur), encoding="utf-8")
        print(f"{app:34s} bindEvents {before} → {oj-oi+1}줄   app.js {len(cur)}줄")

elif cmd in ("place","apply"):
    for app in apps:
        files = sorted((ROOT/app/"events").glob("*.js"))
        texts = {p: p.read_text(encoding="utf-8").split("\n") for p in files}
        ps = plan(app, base, texts)
        if not ps: print(f"■ {app}: 덩어리 없음"); continue
        print(f"■ {app}: 덩어리 {len(ps)}개")
        for p,at,ndel,ins,tag in sorted(ps, key=lambda x:-x[1]):
            print(f"    {tag:7s} {p.relative_to(ROOT)}  {at}행  -{ndel} +{len(ins)}")
            for l in ins[:4]: print(f"        + {l.strip()[:88]}")
            if len(ins)>4: print(f"        + … {len(ins)-4}줄 더")
            if cmd == "apply": texts[p][at:at+ndel] = ins
        if cmd == "apply":
            for p,L in texts.items(): p.write_text("\n".join(L), encoding="utf-8")

elif cmd == "diff":
    from collections import Counter
    for app in apps:
        t = Counter(l.strip() for l in body("origin/main",app) if l.strip())
        m = Counter(l.strip() for l in ours_lines(app) if l.strip())
        miss, extra = t-m, m-t
        print(f"■ {app}\n   저쪽 {sum(t.values())}줄 · 우리 {sum(m.values())}줄"
              f"   넣어야 할 줄 {sum(miss.values())} · 우리에만 {sum(extra.values())}")
        for l,c in list(miss.most_common())[:8]: print(f"     넣을 것 {l[:96]}")
        for l,c in list(extra.most_common())[:8]: print(f"     우리만  {l[:96]}")
