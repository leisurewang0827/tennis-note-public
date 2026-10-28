"""DEV564 수동 게시에만 적용. 기존 563 guard/핀과 운영 경로는 변경하지 않는다."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "scripts/check_r3_purchase_identity_admission.mjs"
RUNTIME_GUARD = "scripts/check_r3_dev_deployment.py"
RUNTIME_SHA = "a3019d1b523ac8a30495a7683d8aa3028f1dcff55faa6f56556066b07c767418"
BASE = "b18de04ee6e883ecf4f530aee678732fb5e0d783"
BASE_TREE = "bcc1512c7989ae052d09f4d309485b66d4308e91"
REF = "refs/heads/codex/tennisnote-r3-registration-dev564-public-20261028"
REPOSITORY = "leisurewang0827/tennis-note-public"
WORKFLOW_REF = REPOSITORY + "/.github/workflows/deploy-cloudflare-pages-dev.yml@" + REF
PROJECT_FP = "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba"
RELEASE = {"version": "1.0.564", "appSurfaceVersion": "1.0.564", "releaseId": "2026.10.28.03", "deployedAt": "2026-10-28T14:25:42+09:00", "memberCache": "tennis-note-member-pwa-v597", "coachCache": "tennis-note-coach-mode-v570"}
PRODUCTS = {
    "app/admin/actions/member.js": "d7a468285b07c022f1bb8dbe0669dbe43ba7c5ab67db1c9aac115f2125982aa4",
    "app/admin/ui/member.js": "0bc3fc4b8816a9e645b5e51db8b7fa84d16a84c5880872bb27ade5bcf975dc25",
    "app/admin/domain/members.js": "bd9b39bff08186ec37dd1b5f0af27ab34cafbb7a68859b9f5e9c8fa0afb8db54",
}
UI = "shared/tennisnote-settlement-adjustment.js"
UI_SHA = "1b2c2fe4e7a3bcb1e629a40e1ef7ab59423279b639e30be3b2cba6f7892c2e41"
TERM_BASE = "80147fb6c0ae1de7fb539587a6370fdbf7af67f5"
TERM_BASE_TREE = "adc8ceb8aaccca0720d74de4aa97b019f991e272"
TERM_RELEASE = {"version": "1.0.565", "appSurfaceVersion": "1.0.565", "releaseId": "2026.10.28.04", "deployedAt": "2026-10-28T18:49:26+09:00", "memberCache": "tennis-note-member-pwa-v598", "coachCache": "tennis-note-coach-mode-v571"}
TERM_PRODUCTS = {**PRODUCTS,
    "app/admin/actions/coach.js": "48a36468df968686b913051dab2346318100571462814f40ae4d1b5fe89298bf",
    "app/admin/domain/coaches.js": "2380cd04d5c31107482d04e02647ed2901b50a197d2bf5051339d152c4cf37bc"}


def digest(value):
    return hashlib.sha256(value.replace(b"\r\n", b"\n")).hexdigest()


def preflight(env, proof, guard, read_bytes, term_history=False):
    release = TERM_RELEASE if term_history else RELEASE
    base = TERM_BASE if term_history else BASE
    base_tree = TERM_BASE_TREE if term_history else BASE_TREE
    products = TERM_PRODUCTS if term_history else PRODUCTS
    expected = {
        "GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_REF": REF,
        "GITHUB_REF_TYPE": "branch", "GITHUB_REPOSITORY": REPOSITORY,
        "GITHUB_RUN_ATTEMPT": "1", "GITHUB_WORKFLOW": "Deploy Tennis Note development sites",
        "GITHUB_WORKFLOW_REF": WORKFLOW_REF, "TENNISNOTE_WORKFLOW_REF": WORKFLOW_REF,
        "TENNISNOTE_ENVIRONMENT": "development", "TENNISNOTE_PAYMENTS_ENABLED": "false",
        "TENNISNOTE_PAYMENT_MODE": "disabled", "TENNISNOTE_ALLOWED_PAYMENT_METHODS": "",
        "TENNISNOTE_BANK_TRANSFER_ENABLED": "false",
    }
    if any(env.get(k) != v for k, v in expected.items()):
        raise RuntimeError("context")
    sha = env.get("GITHUB_SHA", "")
    if (len(sha) != 40 or any(c not in "0123456789abcdef" for c in sha)
            or env.get("GITHUB_WORKFLOW_SHA") != sha or env.get("TENNISNOTE_CANDIDATE_SHA") != sha
            or proof.get("head") != sha or proof.get("checkout") != sha
            or proof.get("contract") != ("r3-term-history-source/1" if term_history else "r3-purchase-identity-source/1")
            or proof.get("base") != base or proof.get("admissionRoute") != ("dev565-manual" if term_history else "dev564-manual")
            or proof.get("event") != "workflow_dispatch" or proof.get("ref") != REF
            or proof.get("environment") != "development" or proof.get("release") != release
            or proof.get("version") != release["version"]):
        raise RuntimeError("source")
    layers = proof.get("layers")
    if (not isinstance(layers, dict)
            or set(layers) != {"count", "sourceCommit", "metadataCommit", "sourceTree", "metadataTree"}
            or type(layers.get("count")) is not int or layers["count"] != 2
            or any(not isinstance(layers.get(k), str) or len(layers[k]) != 40
                   or any(c not in "0123456789abcdef" for c in layers[k])
                   for k in ("sourceCommit", "metadataCommit", "sourceTree", "metadataTree"))
            or layers["metadataCommit"] != sha or layers["sourceCommit"] in (base, sha)
            or layers["metadataTree"] != proof.get("tree") or layers["sourceTree"] == layers["metadataTree"]
            or base_tree in (layers["sourceTree"], layers["metadataTree"])):
        raise RuntimeError("layers")
    url = urllib.parse.urlsplit(env.get("TENNISNOTE_SUPABASE_URL", ""))
    host = url.hostname or ""
    project = host.removesuffix(".supabase.co")
    if (url.scheme != "https" or not host.endswith(".supabase.co") or url.username or url.password
            or url.port is not None or url.path not in ("", "/") or url.query or url.fragment
            or hashlib.sha256(project.encode()).hexdigest() != PROJECT_FP):
        raise RuntimeError("project")
    # 빌더가 실제 공개 실행 파일을 관리자 배포본으로 복사했는지 HTTP 전에 확인한다.
    for path, sha256 in products.items():
        if proof.get("productHashes", {}).get(path) != sha256:
            raise RuntimeError("product proof")
        for name in (path, "dist/admin-dev/" + path.removeprefix("app/admin/")):
            if digest(read_bytes(name)) != sha256:
                raise RuntimeError("product asset")
    for path in ("app/" + UI, "dist/member-dev/" + UI, "dist/admin-dev/" + UI):
        if digest(read_bytes(path)) != UI_SHA:
            raise RuntimeError("preserved display asset")
    contract = {"release": release, "successorBase": base, "floors": {"development": {"source": base}}}
    guard.verify_current_live_candidate(contract, sha, Path("dist/member-dev"), Path("dist/admin-dev"))
    return guard.verify_current_live_target(contract,
        env.get("EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT", "").lower(),
        env.get("CLOUDFLARE_ACCOUNT_ID", ""), env.get("CLOUDFLARE_API_TOKEN", ""))


def main(args=None):
    try:
        args = [] if args is None else args
        if args not in ([], ["--term-history"]):
            raise RuntimeError("mode")
        term_history = args == ["--term-history"]
        proof = json.loads(subprocess.check_output(["node", SOURCE, "--dev-source", *args], cwd=ROOT, timeout=60, stderr=subprocess.DEVNULL))
        path = ROOT / RUNTIME_GUARD
        if path.is_symlink() or digest(path.read_bytes()) != RUNTIME_SHA:
            raise RuntimeError("runtime guard")
        # 이 고정 모듈은 표준 라이브러리와 기존 cache-floor JSON만 import한다.
        # source/old CLI는 호출하지 않고 검토된 runtime/rollback 두 함수만 재사용한다.
        spec = importlib.util.spec_from_file_location("purchase_identity_runtime", path)
        guard = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(guard)
        preflight(os.environ, proof, guard, lambda name: (ROOT / name).read_bytes(), term_history)
        print("R3_TERM_HISTORY_DEV_PREFLIGHT_PASS" if term_history else "R3_PURCHASE_IDENTITY_DEV_PREFLIGHT_PASS")
        return 0
    except Exception:
        print("R3_PURCHASE_IDENTITY_DEV_PREFLIGHT_HOLD")
        return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
