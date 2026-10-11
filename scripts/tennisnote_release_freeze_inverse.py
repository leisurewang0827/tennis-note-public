"""Explicit metadata/historical stages; immutable pins, no DB/network/golden writes."""
from pathlib import Path
import hashlib
import json
ROOT = Path(__file__).resolve().parents[1]
PIN = "7ed303e24c88c551fb399e799b80ed9dc98dce350ab80da105ed1ba7324c8bdd"
RAW = (ROOT / "tests/fixtures/release-freeze-mechanical-parity.json").read_bytes()
if hashlib.sha256(RAW).hexdigest() != PIN:
    raise RuntimeError("mechanical freeze contract drift")
CONTRACT = json.loads(RAW)
ROWS = {row["path"]: row for row in CONTRACT["files"] if row["side"] == "public"}
def _load_reviewed(name: str, pin: str) -> dict:
    raw = (ROOT / "tests/fixtures" / name).read_bytes()
    if hashlib.sha256(raw).hexdigest() != pin:
        raise RuntimeError("reviewed contract drift: " + name)
    return json.loads(raw)

CORRECTION = _load_reviewed("ci39-correction-parity.json", "e90bfe72f20cb2304aa618a4b60e48c78d8624071527ca32c7f68e46f871b08b")
BOUNDED = _load_reviewed("production-isolation-historical-delta.json", "ca06b5537bb4328b365bde336fce6d159a9f8413a8065028632aab43a2329059")
if (len(CORRECTION["files"]) != 6 or len(BOUNDED["files"]) != 29
        or len({r["path"] for r in BOUNDED["files"]}) != 29):
    raise RuntimeError("reviewed contract shape drift")
CURRENT_OUTER = {r["path"]: r for r in CORRECTION["files"] + BOUNDED["shared"] if r["side"] == "public"}

def _reverse(path: str, data: bytes, row: dict) -> bytes:
    text = data.decode("utf-8").replace("\r\n", "\n")
    found = hashlib.sha256(text.encode()).hexdigest()
    if found == row["beforeSha256"]:
        return text.encode()
    if found != row["afterSha256"]:
        raise RuntimeError("reviewed candidate drift: " + path)
    for hunk in reversed(row["hunks"]):
        if not hunk["after"] or text.count(hunk["after"]) != 1:
            raise RuntimeError("reviewed missing/duplicate hunk: " + path)
        text = text.replace(hunk["after"], hunk["before"], 1)
    if hashlib.sha256(text.encode()).hexdigest() != row["beforeSha256"]:
        raise RuntimeError("reviewed baseline drift: " + path)
    return text.encode()

def restore_bytes(path: str, data: bytes, stage: str = "metadata") -> bytes:
    if stage not in ("metadata", "historical-integrated"):
        raise RuntimeError("source stage unknown")
    if Path(path).is_absolute() or ".." in path.replace("\\", "/").split("/"):
        raise RuntimeError("source path invalid")
    if stage == "historical-integrated":
        # alignment의 Excel retry 소비자는 현 preview를 자신의 exact adapter로 복원한다.
        # production-isolation의 별도 4-hunk preimage를 이 단계에 섞지 않는다.
        row = CURRENT_OUTER.get(path)
        if row is not None:
            data = _reverse(path, data, row)
    row = ROWS.get(path)
    if row is None:
        return data
    source = data.decode("utf-8").replace("\r\n", "\n").encode("utf-8")
    baseline = row["beforeSource"].encode("utf-8")
    if hashlib.sha256(baseline).hexdigest() != row["beforeSha256"]:
        raise RuntimeError("mechanical baseline drift: " + path)
    found = hashlib.sha256(source).hexdigest()
    if found not in (row["beforeSha256"], row["afterSha256"]):
        raise RuntimeError("mechanical source drift: " + path)
    return baseline
def verify_current(root: Path = ROOT) -> None:
    for path, row in ROWS.items():
        actual = (root / path).read_text(encoding="utf-8").replace("\r\n", "\n").encode("utf-8")
        if hashlib.sha256(actual).hexdigest() != row["afterSha256"]:
            raise RuntimeError("unfrozen current metadata: " + path)
    for path, row in CURRENT_OUTER.items():
        actual = (root / path).read_text(encoding="utf-8").replace("\r\n", "\n").encode("utf-8")
        if hashlib.sha256(actual).hexdigest() != row["afterSha256"]:
            raise RuntimeError("unfrozen current correction: " + path)
        _reverse(path, actual, row)
