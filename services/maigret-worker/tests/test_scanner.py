"""Basic scanner tests — no network required."""

import pytest

from app.scanner import (
    ScanOptions,
    ScanResult,
    _normalize_maigret_result,
    _extract_platform_name,
    _extract_url,
    _extract_ids_data,
)


def test_normalize_dict_with_platforms_key():
    raw = {
        "platforms": [
            {
                "name": "GitHub",
                "url": "https://github.com/alice",
                "status": "found",
                "ids_data": {"bio": "engineer", "company": "Acme", "avatar_url": "https://x/a.png"},
            },
            {
                "name": "Twitter",
                "url": "https://twitter.com/alice",
                "status": "found",
            },
        ]
    }
    result = _normalize_maigret_result(raw, "alice")
    assert result.username == "alice"
    assert len(result.platforms) == 2
    assert result.platforms[0]["platform"] == "github"
    assert result.platforms[0]["ids_data"]["company"] == "Acme"
    assert result.platforms[1]["ids_data"] == {}


def test_normalize_list_of_tuples():
    raw = [("GitHub", "https://github.com/bob"), ("Reddit", "https://reddit.com/u/bob")]
    result = _normalize_maigret_result(raw, "bob")
    assert result.sites_found == 2
    assert {p["platform"] for p in result.platforms} == {"github", "reddit"}


def test_normalize_none():
    result = _normalize_maigret_result(None, "ghost")
    assert result.sites_found == 0
    assert result.platforms == []


def test_normalize_ignores_entries_without_url():
    raw = {"platforms": [{"name": "Broken"}]}
    result = _normalize_maigret_result(raw, "x")
    assert result.sites_found == 0


def test_extract_helpers_with_dict():
    entry = {"name": "GH", "url": "https://gh", "status": "found", "ids_data": {"bio": "x"}}
    assert _extract_platform_name(entry) == "GH"
    assert _extract_url(entry) == "https://gh"
    assert _extract_status(entry) == "found"
    assert _extract_ids_data(entry)["bio"] == "x"


def test_extract_helpers_with_list():
    assert _extract_platform_name(["GH", "https://gh"]) == "GH"
    assert _extract_url(["GH", "https://gh"]) == "https://gh"


def test_extract_ids_data_with_string_payload():
    # legacy maigret sometimes returns a JSON string in `ids`
    entry = {"ids_data": '{"bio": "from string", "company": "Z"}'}
    out = _extract_ids_data(entry)
    assert out == {}  # not a dict, treated as no data


def test_scanner_options_defaults():
    opts = ScanOptions()
    assert opts.top == 500
    assert opts.is_parsing_enabled is True
    assert opts.timeout_ms == 15000
    assert opts.enable_cloudflare_bypass is False
    assert opts.parse_url is None
