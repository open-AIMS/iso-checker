#!/usr/bin/env python3
"""
Local CORS proxy and static file server for the ISO 19115-3 Metadata Checker.

Proxies requests to GeoNetwork catalogues and PID APIs that may not support
CORS, adding the necessary headers for browser access. Also serves static
files from the working directory so no separate web server is needed during
development.

Usage:
    python proxy.py              # default port 8080
    python proxy.py --port 9000  # custom port
"""

import argparse
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

MAX_RESPONSE_BYTES = 10 * 1024 * 1024  # 10 MB

ALLOWED_HOSTS = {
    # Target catalogues
    "catalogue.eatlas.org.au",
    "metadata.imas.utas.edu.au",
    "ecat.ga.gov.au",
    "geonetwork.nci.org.au",
    # PID APIs
    "api.ror.org",
    "pub.orcid.org",
    "api.datacite.org",
    "raid.org",
}


def is_allowed(url: str) -> bool:
    """Check that a target URL uses an allowed host and HTTPS (or http for localhost)."""
    parsed = urllib.parse.urlparse(url)
    hostname = parsed.hostname or ""
    scheme = parsed.scheme

    if hostname in ("localhost", "127.0.0.1", "::1"):
        return scheme in ("http", "https")

    if scheme != "https":
        return False

    return hostname in ALLOWED_HOSTS


class ProxyHandler(BaseHTTPRequestHandler):
    """Handles /proxy requests (GET/POST) and serves static files for all other paths."""

    # Suppress default stderr logging of every request
    def log_message(self, format, *args):
        print(f"[proxy] {args[0]}" if args else "")

    # ── CORS helpers ──────────────────────────────────────────────────

    def _cors_headers(self):
        return {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Accept",
            "Access-Control-Max-Age": "86400",
        }

    def _send_cors_headers(self):
        for key, value in self._cors_headers().items():
            self.send_header(key, value)

    # ── Proxy logic ───────────────────────────────────────────────────

    def _handle_proxy(self, method: str):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        target_url = qs.get("url", [None])[0]

        if not target_url:
            self._send_json_error(400, "Missing 'url' query parameter")
            return

        if not is_allowed(target_url):
            self._send_json_error(
                403,
                f"Target host not in allowlist: {urllib.parse.urlparse(target_url).hostname}",
            )
            return

        # Build the outgoing request
        body = None
        if method == "POST":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else None

        req = urllib.request.Request(target_url, data=body, method=method)

        # Forward selected headers
        for header in ("Content-Type", "Accept"):
            value = self.headers.get(header)
            if value:
                req.add_header(header, value)

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_body = resp.read(MAX_RESPONSE_BYTES)
                status = resp.status
                content_type = resp.headers.get("Content-Type", "application/octet-stream")

                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self._send_cors_headers()
                self.send_header("Content-Length", str(len(resp_body)))
                self.end_headers()
                self.wfile.write(resp_body)

        except urllib.error.HTTPError as e:
            # Forward the upstream HTTP error with its original status and body
            try:
                err_body = e.read(MAX_RESPONSE_BYTES)
            except Exception:
                err_body = b""
            content_type = e.headers.get("Content-Type", "application/octet-stream") if e.headers else "application/octet-stream"

            self.send_response(e.code)
            self.send_header("Content-Type", content_type)
            self._send_cors_headers()
            self.send_header("Content-Length", str(len(err_body)))
            self.end_headers()
            self.wfile.write(err_body)

        except Exception as e:
            self._send_json_error(502, f"Proxy error: {e}")

    def _send_json_error(self, code: int, message: str):
        body = json.dumps({"error": message}).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._send_cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ── Static file serving ───────────────────────────────────────────

    def _serve_static(self):
        parsed = urllib.parse.urlparse(self.path)
        req_path = urllib.parse.unquote(parsed.path).lstrip("/")

        if req_path == "" or req_path.endswith("/"):
            req_path = os.path.join(req_path, "index.html")

        # Resolve to filesystem path and ensure it's within the working directory
        base = os.path.realpath(os.getcwd())
        filepath = os.path.realpath(os.path.join(base, req_path))
        if not filepath.startswith(base + os.sep) and filepath != base:
            self.send_error(403, "Forbidden")
            return

        if not os.path.isfile(filepath):
            self.send_error(404, "Not Found")
            return

        content_type, _ = mimetypes.guess_type(filepath)
        if content_type is None:
            content_type = "application/octet-stream"

        try:
            with open(filepath, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except OSError:
            self.send_error(500, "Internal Server Error")

    # ── HTTP method handlers ──────────────────────────────────────────

    def do_OPTIONS(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/proxy":
            self.send_response(204)
            self._send_cors_headers()
            self.end_headers()
        else:
            self.send_error(405, "Method Not Allowed")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/proxy":
            self._handle_proxy("GET")
        else:
            self._serve_static()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/proxy":
            self._handle_proxy("POST")
        else:
            self.send_error(405, "Method Not Allowed")


def main():
    parser = argparse.ArgumentParser(description="CORS proxy and static file server for ISO Metadata Checker")
    parser.add_argument("--port", type=int, default=8080, help="Port to listen on (default: 8080)")
    args = parser.parse_args()

    server = HTTPServer(("127.0.0.1", args.port), ProxyHandler)
    print(f"Proxy listening on http://127.0.0.1:{args.port}")
    print(f"Serving static files from {os.getcwd()}")
    print(f"Proxy endpoint: http://localhost:{args.port}/proxy?url=<encoded-url>")
    print("Press Ctrl+C to stop.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
