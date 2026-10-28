"""검토된 DEV push/563 자식 수동 게시만 연결. 기존 runtime/rollback 보호는 재사용."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "scripts/check_r3_display_source_admission.mjs"
UI = "shared/tennisnote-settlement-adjustment.js"
UI_SHA = "1b2c2fe4e7a3bcb1e629a40e1ef7ab59423279b639e30be3b2cba6f7892c2e41"
DEV_REF = "refs/heads/codex/tennisnote-r3-display-dev563-20261028"
WORKFLOW_PREFIX = "leisurewang0827/tennis-note-public/.github/workflows/deploy-cloudflare-pages-dev.yml@"

def preflight(env, source_proof, guard, read_bytes):
    # 이 함수에 들어오기 전에 Node가 clean tree/event/merge/source 전체를 확인한다.
    event = env.get("GITHUB_EVENT_NAME")
    ref = env.get("GITHUB_REF")
    manual = event == "workflow_dispatch"
    if manual:
        if (ref != DEV_REF or env.get("GITHUB_REF_TYPE") != "branch"
            or source_proof.get("admissionRoute") != "dev563-manual"
            or source_proof.get("checkout") != env.get("GITHUB_SHA")
            or source_proof.get("ref") != DEV_REF
            or env.get("TENNISNOTE_CANDIDATE_SHA") != source_proof.get("head")
            or env.get("GITHUB_WORKFLOW_REF") != WORKFLOW_PREFIX + DEV_REF):
            raise RuntimeError("manual context")
    elif event != "push" or ref != "refs/heads/dev":
        raise RuntimeError("event")
    if (source_proof.get("contract") != "r3-reviewed-display-source/1"
        or source_proof.get("event") != event or source_proof.get("version") != "1.0.563"
        or source_proof.get("head") != env.get("GITHUB_SHA")
        or env.get("GITHUB_REPOSITORY") != "leisurewang0827/tennis-note-public"
        or env.get("GITHUB_RUN_ATTEMPT") != "1"
        or env.get("GITHUB_WORKFLOW") != "Deploy Tennis Note development sites"
        or env.get("TENNISNOTE_WORKFLOW_REF") != WORKFLOW_PREFIX + ref
        or env.get("TENNISNOTE_ENVIRONMENT") != "development"
        or env.get("TENNISNOTE_PAYMENTS_ENABLED") != "false"
        or env.get("TENNISNOTE_PAYMENT_MODE") != "disabled"
        or env.get("TENNISNOTE_ALLOWED_PAYMENT_METHODS") != ""
        or env.get("TENNISNOTE_BANK_TRANSFER_ENABLED") != "false"):
        raise RuntimeError("context")
    for name in ("app/"+UI, "dist/member-dev/"+UI, "dist/admin-dev/"+UI):
        if hashlib.sha256(read_bytes(name).replace(b"\r\n", b"\n")).hexdigest() != UI_SHA:
            raise RuntimeError("asset")
    # 기존 함수는 exact project fingerprint/payment OFF/banner/metadata/cache를 확인한 뒤 bounded GET만 한다.
    contract = {"release": source_proof["release"], "successorBase": "007ec7a58d2ea123f8a1f6774efeb50e1975590c",
                "floors": {"development": {"source": "007ec7a58d2ea123f8a1f6774efeb50e1975590c"}}}
    guard.verify_current_live_candidate(contract, source_proof["head"], Path("dist/member-dev"), Path("dist/admin-dev"))
    return guard.verify_current_live_target(contract,
        env.get("EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT", "").lower(),
        env.get("CLOUDFLARE_ACCOUNT_ID", ""), env.get("CLOUDFLARE_API_TOKEN", ""))

def main():
    try:
        # No inherited old source admission is bypassed: new exact source proof precedes runtime and any HTTP.
        proof = json.loads(subprocess.check_output(["node", SOURCE, "--dev-source"], cwd=ROOT, stderr=subprocess.DEVNULL))
        import check_r3_dev_deployment as guard
        preflight(os.environ, proof, guard, lambda name: (ROOT/name).read_bytes())
        print("R3_DISPLAY_DEV_PREFLIGHT_PASS")
        return 0
    except Exception:
        print("R3_DISPLAY_DEV_PREFLIGHT_HOLD")
        return 2

if __name__ == "__main__":
    raise SystemExit(main())
