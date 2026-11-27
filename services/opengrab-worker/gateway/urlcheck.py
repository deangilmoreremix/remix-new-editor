from __future__ import annotations

import ipaddress
import socket
from collections.abc import Callable
from urllib.parse import urlsplit, urlunsplit

ALLOWED_PORTS = {80, 443, 8080, 8443}
_BLOCKED_HOSTS = {"localhost", "metadata.google.internal", "metadata", "instance-data"}
_BLOCKED_SUFFIXES = (".local", ".localhost", ".internal", ".lan", ".home.arpa")

Resolver = Callable[[str], list[str]]


class UrlRejected(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _resolve(host: str) -> list[str]:
    infos = socket.getaddrinfo(host, None, family=socket.AF_UNSPEC)
    return [i[4][0] for i in infos]


def _ip_ok(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    # is_global is False for private, loopback, link-local (incl. 169.254.169.254), CGNAT 100.64/10,
    # reserved, multicast and unspecified ranges. Unwrap IPv4-mapped IPv6 first.
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


def validate_public_url(url: str, resolver: Resolver = _resolve) -> str:
    """Return a canonical http(s) URL for a public host, or raise UrlRejected.

    This is the first of two layers: it rejects obvious abuse early. It does not stop DNS rebinding or
    redirects chosen by the remote site; those are handled by the egress proxy that yt-dlp is run through.
    """
    url = (url or "").strip()
    if not url or len(url) > 2048 or any(c in url for c in "\r\n\t "):
        raise UrlRejected("url_invalid")
    try:
        parts = urlsplit(url)
        host = parts.hostname
        port = parts.port
    except ValueError:
        raise UrlRejected("url_invalid") from None
    if parts.scheme not in ("http", "https") or not host:
        raise UrlRejected("url_scheme")
    if parts.username or parts.password:
        raise UrlRejected("url_credentials")
    if port is not None and port not in ALLOWED_PORTS:
        raise UrlRejected("url_port")
    host = host.lower().rstrip(".")
    if host in _BLOCKED_HOSTS or host.endswith(_BLOCKED_SUFFIXES):
        raise UrlRejected("url_internal")
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None:
        if not _ip_ok(literal):
            raise UrlRejected("url_internal")
    else:
        try:
            addrs = resolver(host)
        except (socket.gaierror, UnicodeError, OSError):
            raise UrlRejected("url_unresolvable") from None
        if not addrs:
            raise UrlRejected("url_unresolvable")
        for addr in addrs:  # every address must be public: one private A record is enough to reject
            try:
                ip = ipaddress.ip_address(addr)
            except ValueError:
                raise UrlRejected("url_unresolvable") from None
            if not _ip_ok(ip):
                raise UrlRejected("url_internal")
    default = 443 if parts.scheme == "https" else 80
    shown = f"[{host}]" if ":" in host else host
    netloc = shown if port in (None, default) else f"{shown}:{port}"
    return urlunsplit((parts.scheme, netloc, parts.path or "/", parts.query, ""))
