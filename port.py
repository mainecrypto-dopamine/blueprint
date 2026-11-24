#!/usr/bin/env python3
"""Rebuild the website's index.html from the Blueprint artifact page.

The artifact in Claude stays the design file. Make UI changes there, save its
index.html as artifact.html in this folder, then run:  python3 port.py
It also writes vercel.json from config.js so /_blob/<id> files come from Supabase Storage.
"""
import re, sys, json, pathlib

src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "artifact.html").read_text(encoding="utf-8")
s = src

def once(old, new):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit(f"port.py: expected exactly one match for {old[:60]!r}, found {n}")
    s = s.replace(old, new)

HEAD = """<meta name="theme-color" content="#0A0A0A">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Blueprint HQ">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/favicon.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js"></script>
<script src="config.js"></script>
<script src="backend.js"></script>
<script src="install.js"></script>
<title>"""
once("<title>", HEAD)

# links back to the site itself instead of the claude.ai artifact
s = s.replace('https://claude.ai/artifact/1HMMCNQu3v2Hs7uqWuYyYh', '/')
s = s.replace('Shared with the team and always up to date. Bookmark it or add it to your home screen.', 'Shared with the team and always up to date. Bookmark it, or ☰ → Install app.')

once("</body>", '<script>if("serviceWorker" in navigator&&!window.BP_OFFLINE)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}))</script>\n</body>')

pathlib.Path("index.html").write_text(s, encoding="utf-8")

cfg = pathlib.Path("config.js").read_text(encoding="utf-8")
m = re.search(r'supabaseUrl:\s*"([^"]+)"', cfg)
url = m.group(1) if m else ""
if url and "YOUR_" not in url:
    vercel = {"redirects": [{"source": "/_blob/:id", "destination": url.rstrip("/") + "/storage/v1/object/public/assets/:id", "permanent": False}],
              "headers": [{"source": "/sw.js", "headers": [{"key": "Cache-Control", "value": "no-cache"}]}]}
    pathlib.Path("vercel.json").write_text(json.dumps(vercel, indent=2) + "\n", encoding="utf-8")
    print("vercel.json written for", url)
print("index.html rebuilt from", sys.argv[1] if len(sys.argv) > 1 else "artifact.html")
