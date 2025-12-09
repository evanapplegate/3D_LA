#!/usr/bin/env python3
"""
Simple HTTP server for car flip physics simulation.
Verbose error logging to console and errors.log
"""
import http.server
import socketserver
import os
import sys
import traceback
from datetime import datetime

ERROR_LOG = 'errors.log'

def log_error(msg, exc=None):
    """Log error to both console and file"""
    timestamp = datetime.now().isoformat()
    error_msg = f"[{timestamp}] {msg}\n"
    if exc:
        error_msg += f"{traceback.format_exc()}\n"
    
    print(f"ERROR: {error_msg}", file=sys.stderr)
    with open(ERROR_LOG, 'a') as f:
        f.write(error_msg)

class VerboseHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        """Override to be more verbose"""
        msg = format % args
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")
    
    def do_GET(self):
        try:
            return super().do_GET()
        except Exception as e:
            log_error(f"GET {self.path} failed", e)
            self.send_error(500, "Internal server error")
    
    def end_headers(self):
        # Add CORS headers for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def main():
    PORT = 8000
    
    # Clear error log
    if os.path.exists(ERROR_LOG):
        os.remove(ERROR_LOG)
    
    try:
        with socketserver.TCPServer(("", PORT), VerboseHandler) as httpd:
            print(f"Server starting on http://localhost:{PORT}")
            print(f"Errors logged to {ERROR_LOG}")
            print("Press Ctrl+C to stop")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
    except Exception as e:
        log_error("Server startup failed", e)
        sys.exit(1)

if __name__ == '__main__':
    main()