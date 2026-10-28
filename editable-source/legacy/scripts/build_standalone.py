#!/usr/bin/env python3
"""Produce a self-contained Vercel preview HTML with SHA-256 CSP; community data fetched separately.
Does not certify political boundaries. Research preview only.
"""
from pathlib import Path
from hashlib import sha256
import base64
from html import escape
R=Path(__file__).resolve().parents[1]
html=(R/'index.html').read_text()
css=(R/'styles.css').read_text()
js=(R/'app.js').read_text()
assert 'noindex, nofollow' in html and 'Research preview' in html
assert 'PROVISIONAL GEOMETRY' in js
assert '<link rel="stylesheet" href="./styles.css" />' in html
assert '<script defer src="./app.js"></script>' in html
css_hash=base64.b64encode(sha256(css.encode()).digest()).decode()
js_hash=base64.b64encode(sha256(js.encode()).digest()).decode()
csp=f"default-src 'self'; connect-src 'self' https://cdn.jsdelivr.net https://raw.githubusercontent.com; img-src 'self' blob: data:; script-src 'sha256-{js_hash}'; style-src 'sha256-{css_hash}'; object-src 'none'; base-uri 'self'"
html=html.replace('<meta name="viewport"',f'<meta http-equiv="Content-Security-Policy" content="{escape(csp,quote=True)}" />\n<meta name="viewport"',1)
html=html.replace('<link rel="stylesheet" href="./styles.css" />','<style>'+css+'</style>',1)
html=html.replace('<script defer src="./app.js"></script>','<script>'+js+'</script>',1)
out=R/'standalone';out.mkdir(exist_ok=True)
(out/'index.html').write_text(html)
(out/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
print('Created standalone preview at',out/'index.html','bytes:',len(html.encode()))
