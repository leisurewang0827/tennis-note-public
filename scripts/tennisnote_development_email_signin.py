"""Canonical development-only existing-account UI manifest; no Auth operations."""
import hashlib
from urllib.parse import urlsplit

DEVELOPMENT_PROJECT_FINGERPRINT = "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba"
CONTRACT_VERSION = "development-existing-sign-in/1"

def development_signin_config(environment, supabase_url, requested,
                              expected_fingerprint=DEVELOPMENT_PROJECT_FINGERPRINT):
    # No opt-in or production: do not expose any email UI, even with the old flag.
    result = {"featureFlags": {"emailPasswordAuthUi": False, "developmentEmailSignIn": False}}
    if not requested:
        return result
    url = urlsplit(supabase_url)
    hostname = url.hostname or ""
    ref = hostname.removesuffix(".supabase.co")
    actual = hashlib.sha256(ref.encode()).hexdigest()
    if (environment != "development" or url.scheme != "https"
        or not hostname.endswith(".supabase.co") or not ref or "." in ref
        or url.username or url.password or url.port or url.query or url.fragment
        or url.path not in ("", "/") or actual != expected_fingerprint):
        raise ValueError("development_existing_signin_manifest_mismatch")
    result["featureFlags"]["developmentEmailSignIn"] = True
    result["developmentEmailSignInManifest"] = {
        "contractVersion": CONTRACT_VERSION, "environment": "development",
        "projectFingerprint": actual, "supabaseOrigin": "https://" + hostname,
    }
    return result
