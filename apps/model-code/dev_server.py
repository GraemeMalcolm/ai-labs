"""Development server for Model Coder with cross-origin isolation headers.

Run:
    python dev_server.py

This enables SharedArrayBuffer-dependent PyScript worker interop.
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler


class COIServerHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 8010), COIServerHandler)
    print("Model Coder dev server running at http://127.0.0.1:8010")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
