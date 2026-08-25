#!/usr/bin/env python3
"""충돌한 app.js 를 "저쪽 것에서 우리가 옮긴 것만 빼기" 로 푼다.

    git merge origin/main --no-commit          # 충돌이 난 상태에서
    ./scripts/merge_resolve.py app/admin app/tennis-note-member-app app/tennis-note-coach-app

저쪽 app.js 를 통째로 가져와서 우리가 다른 파일로 옮긴 함수·상수를 다시
빼낸다. 충돌 블록을 손으로 고르면 저쪽 변경을 놓친다.

두 가지가 핵심이다.

1. 저쪽 본문과 우리 본문이 다르다고 바로 바꾸면 안 된다. 우리 쪽에는
   기본값 이음매와 XSS 수정이 들어 있어서 그러면 통째로 되돌아간다.
   기준점(merge-base)과 저쪽을 비교해 "저쪽이 실제로 고친 것" 만 손대고,
   우리도 고쳐둔 것이면 바꾸지 않고 사람에게 보고한다.
2. 어느 파일이 이 앱 것인지는 index.html 의 스크립트 목록으로 정한다.
   app/shared/ 를 통째로 훑으면 공용 파일을 한 앱 본문으로 덮어쓴다.

bindEvents 는 일부러 건드리지 않는다. scripts/merge_bindevents.py 로 따로 한다.
자세한 절차는 docs/merging.md.
"""
import re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
DECL = re.compile(r"^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(")
BIND = re.compile(r"^(const|let|var)\s+([A-Za-z0-9_$]+)\s*=")

def show(ref, path):
    r = subprocess.run(["git","show",f"{ref}:{path}"], cwd=ROOT, capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None

def strip_quotes(text):
    """문자열·주석을 공백으로 지운다. 템플릿 리터럴의 ${ } 중첩을 따라간다.

    예전 버전은 백틱을 만나면 다음 백틱까지를 통째로 문자열로 봤다.
    이 코드베이스는 템플릿 안 템플릿(`${...}` 속 백틱) 처럼 템플릿 안에 템플릿이
    흔해서, 그 지점부터 코드와 문자열이 뒤집힌 채 끝까지 갔다.
    실제로 1.0.405 병합에서 그 어긋난 구간의 상수 선언을 못 보고
    잘라내지 못해 중복 선언이 생겼다 (script-load 가 잡았다).
    """
    out = []
    stack = []          # "s" 홑, "d" 쌍, "t" 템플릿, 정수 = 템플릿 식의 { 깊이
    i, n = 0, len(text)
    last_code = ""      # 정규식/나눗셈 구분용: 마지막으로 내보낸 코드 문자
    while i < n:
        c = text[i]
        top = stack[-1] if stack else None
        in_string = top in ("s", "d", "t")
        if in_string:
            if c == "\\":
                out.append("  "); i += 2; continue
            if c == "\n":
                out.append("\n"); i += 1; continue
            if top == "s" and c == "'" or top == "d" and c == '"' or top == "t" and c == "`":
                stack.pop(); out.append(" "); i += 1; continue
            if top == "t" and c == "$" and i + 1 < n and text[i+1] == "{":
                stack.append(0); out.append("  "); i += 2; continue   # 템플릿 식 시작 = 코드로 복귀
            out.append(" "); i += 1; continue
        # 코드 상태 (최상위이거나 템플릿 식 안)
        if c == "'": stack.append("s"); out.append(" "); i += 1; continue
        if c == '"': stack.append("d"); out.append(" "); i += 1; continue
        if c == "`": stack.append("t"); out.append(" "); i += 1; continue
        if c == "/" and i + 1 < n and text[i+1] == "/":
            while i < n and text[i] != "\n": out.append(" "); i += 1
            continue
        if c == "/":
            # 정규식인가 나눗셈인가: 직전 코드 문자가 값이면 나눗셈, 아니면 정규식.
            # 정규식 안의 따옴표(.replace(/&quot;/gi, '"')) 때문에 이걸 안 가리면
            # 그 지점부터 문자열과 코드가 뒤집힌다.
            if last_code == "" or last_code in "(,=:[!&|?{};+-*%~^<>":
                out.append(" "); i += 1
                in_class = False
                while i < n:
                    r = text[i]
                    if r == "\\": out.append("  "); i += 2; continue
                    if r == "\n": break                      # 정규식은 줄을 못 넘는다
                    if r == "[": in_class = True
                    elif r == "]": in_class = False
                    elif r == "/" and not in_class:
                        out.append(" "); i += 1
                        while i < n and text[i].isalpha(): out.append(" "); i += 1
                        break
                    out.append(" "); i += 1
                continue
        if isinstance(top, int):
            if c == "{": stack[-1] += 1
            elif c == "}":
                if top == 0:
                    stack.pop(); out.append(" "); i += 1; continue    # 템플릿으로 복귀
                stack[-1] -= 1
        out.append(c)
        if not c.isspace(): last_code = c
        i += 1
    return "".join(out)

def functions(lines):
    out, i = {}, 0
    while i < len(lines):
        m = DECL.match(lines[i])
        if not m: i += 1; continue
        j = i + 1
        while j < len(lines) and lines[j] != "}": j += 1
        out[m.group(1)] = (i, j); i = j + 1
    return out

def declarations(lines, clean):
    out, i = {}, 0
    while i < len(lines):
        m = BIND.match(lines[i])
        if not m: i += 1; continue
        depth, end = 0, None
        for s in range(i, len(lines)):
            l = clean[s]
            depth += l.count("(") + l.count("[") + l.count("{")
            depth -= l.count(")") + l.count("]") + l.count("}")
            if depth == 0 and l.rstrip().endswith(";"): end = s; break
        if end is None: i += 1; continue
        out[m.group(2)] = (i, end); i = end + 1
    return out

def app_scripts(app_rel):
    html = (ROOT / app_rel / "index.html").read_text(encoding="utf-8")
    paths = []
    for src in re.findall(r'<script[^>]*\ssrc="([^"]+)"', html):
        if src.startswith("http") or "config.local" in src: continue
        p = (ROOT / app_rel / src.split("?")[0]).resolve()
        if p.name in ("app.js", "schedule-v2-admin.js"): continue
        if p.exists() and p.suffix == ".js": paths.append(p)
    return paths

def resolve(app_rel, base, upstream="origin/main"):
    app_js = f"{app_rel}/app.js"
    tl = show(upstream, app_js).split("\n"); bl = show(base, app_js).split("\n")
    their_fn, base_fn = functions(tl), functions(bl)
    their_c = declarations(tl, strip_quotes("\n".join(tl)).split("\n"))
    base_c  = declarations(bl, strip_quotes("\n".join(bl)).split("\n"))
    def body(lines, span): return "\n".join(lines[span[0]:span[1]+1])
    changed  = {n for n in their_fn if n in base_fn and body(tl,their_fn[n]) != body(bl,base_fn[n])}
    changed |= {n for n in their_c  if n in base_c  and body(tl,their_c[n])  != body(bl,base_c[n])}
    lives = {}
    for p in app_scripts(app_rel):
        t = p.read_text(encoding="utf-8"); L = t.split("\n")
        for n,s in functions(L).items(): lives.setdefault(n,(p, body(L,s)))
        for n,s in declarations(L, strip_quotes(t).split("\n")).items(): lives.setdefault(n,(p, body(L,s)))
    cuts, replaced, manual, untouched = [], [], [], 0
    for name, span, kind in ([(n,s,"fn") for n,s in their_fn.items()]
                             + [(n,s,"const") for n,s in their_c.items()]):
        if name not in lives: continue
        cuts.append(span)
        p, ourbody = lives[name]
        if name not in changed: untouched += 1; continue
        theirbody = body(tl, span)
        basebody  = body(bl, base_fn[name] if kind=="fn" else base_c[name])
        if ourbody != basebody:
            manual.append(f"{name}  ({p.relative_to(ROOT)}) — 우리가 고쳐둔 것이라 손으로 봐야 함"); continue
        t = p.read_text(encoding="utf-8")
        assert ourbody in t, f"{p.name}: {name} 본문 못 찾음"
        p.write_text(t.replace(ourbody, theirbody, 1), encoding="utf-8")
        replaced.append(f"{name} → {p.relative_to(ROOT)}")
    cuts.sort()
    for (a1,b1),(a2,_) in zip(cuts, cuts[1:]):
        assert b1 < a2, f"{app_rel}: 범위 겹침"
    kept, cursor = [], 0
    for a,b in cuts:
        kept.extend(tl[cursor:a]); end = b + 1
        if end < len(tl) and tl[end] == "": end += 1
        cursor = end
    kept.extend(tl[cursor:])
    return "\n".join(kept), len(cuts), untouched, replaced, manual

if __name__ == "__main__":
    base = subprocess.run(["git","merge-base","origin/main","HEAD"], cwd=ROOT,
                          capture_output=True, text=True, check=True).stdout.strip()
    for app in sys.argv[1:]:
        text, n_cut, n_same, replaced, manual = resolve(app, base)
        (ROOT/app/"app.js").write_text(text, encoding="utf-8")
        print(f"■ {app}: {n_cut}개 잘라냄 (그중 {n_same}개는 저쪽이 안 고침) → {text.count(chr(10))+1}줄")
        for r in replaced: print(f"    교체: {r}")
        for m in manual:   print(f"    ⚠ 손으로 확인: {m}")
        if not replaced and not manual: print("    교체할 것 없음")
