"""Exact metadata inverse; no Git, database, network, or fixture regeneration."""
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
def restore_bytes(path: str, data: bytes) -> bytes:
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
