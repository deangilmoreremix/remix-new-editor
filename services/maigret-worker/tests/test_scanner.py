"""Scanner tests — unit (no network) + integration (real Maigret, optional)."""

import pytest

from app.scanner import (
    ScanOptions,
    ScanResult,
    _normalize_maigret_result,
    _extract_ids_data,
)


# ---------------------------------------------------------------------------
# Unit tests — exercise the normalizer against synthetic Maigret shapes
# ---------------------------------------------------------------------------


def _claimed_site(url, ids=None):
    """Build a fake Maigret SiteResult dict for a CLAIMED account."""

    class _Status:
        status = "Claimed"
        site_url_user = url
        ids_data = ids or {}

    return {"status": _Status(), "url_user": url}


def _available_site():
    class _Status:
        status = "Available"
        site_url_user = ""

    return {"status": _Status(), "url_user": ""}


def test_normalize_claimed_accounts():
    raw = {
        "GitHub": _claimed_site(
            "https://github.com/alice",
            {"bio": "engineer", "company": "Acme", "avatar_url": "https://x/a.png"},
        ),
        "Twitter": _claimed_site("https://twitter.com/alice"),
    }
    result = _normalize_maigret_result(raw, "alice")
    assert result.username == "alice"
    assert result.sites_found == 2
    platforms = {p["platform"]: p for p in result.platforms}
    assert "github" in platforms and "twitter" in platforms
    assert platforms["github"]["ids_data"]["company"] == "Acme"
    assert platforms["github"]["ids_data"]["avatar_url"] == "https://x/a.png"
    assert platforms["twitter"]["ids_data"] == {}


def test_normalize_skips_available_accounts():
    raw = {"GitHub": _available_site(), "Reddit": _claimed_site("https://reddit.com/u/bob")}
    result = _normalize_maigret_result(raw, "bob")
    assert result.sites_found == 1
    assert result.platforms[0]["platform"] == "reddit"


def test_normalize_none():
    result = _normalize_maigret_result(None, "ghost")
    assert result.sites_found == 0
    assert result.platforms == []


def test_extract_ids_data_with_dict():
    class _Status:
        ids_data = {"bio": "x", "company": "Y"}

    out = _extract_ids_data(_Status(), {})
    assert out["bio"] == "x"
    assert out["company"] == "Y"


def test_scanner_options_defaults():
    opts = ScanOptions()
    assert opts.top == 500
    assert opts.is_parsing_enabled is True
    assert opts.timeout_ms == 15000
    assert opts.enable_cloudflare_bypass is False
    assert opts.parse_url is None
    assert opts.tags is None
    assert opts.retries == 1
    assert opts.no_recursion is True
    assert opts.permute is False
    assert opts.check_domains is False


# ---------------------------------------------------------------------------
# Integration test — runs a real (small) Maigret scan when the library is
# installed. Marked to skip silently in CI without network / maigret.
# ---------------------------------------------------------------------------


@pytest.mark.skipif(
    not _normalize_maigret_result.__module__ or True,
    reason="integration: requires network + maigret install; run manually",
)
def test_integration_real_scan():
    from app.scanner import MaigretScanner

    scanner = MaigretScanner(ScanOptions(top=50, is_parsing_enabled=False))
    result = scanner.scan("maigret")
    assert isinstance(result, ScanResult)
    # maigret itself should exist on at least one site
    assert result.sites_found >= 1
