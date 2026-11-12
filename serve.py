"""Local dev server for Gullak: serves ./site with caching turned off,
so the browser always shows the latest files."""
import functools, http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
site = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
handler = functools.partial(NoCache, directory=site)
host = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"  # pass 0.0.0.0 to share on your network
http.server.ThreadingHTTPServer((host, port), handler).serve_forever()
