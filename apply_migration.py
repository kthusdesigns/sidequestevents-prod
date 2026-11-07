#!/usr/bin/env python3
"""Apply audited, narrow edits to the existing SideQuest repository.

Run from the REPOSITORY ROOT after extracting the package there:
    python3 apply_migration.py

Stops before modifying any files if the inspected source is different.
"""
from pathlib import Path

BASE = Path.cwd()
changes = {}


def read(relative):
    path = BASE / relative
    if not path.is_file():
        raise SystemExit(f"Missing expected existing file: {relative}")
    return path.read_text(encoding="utf-8")


def replace_once(text, old, new, relative):
    if text.count(old) != 1:
        raise SystemExit(
            f"STOP: {relative}: expected one exact match, found {text.count(old)}. "
            "Nothing has been edited. Please provide the file for review."
        )
    return text.replace(old, new, 1)


contact_path = "src/content/pages/contact.html"
contact = read(contact_path)
contact = replace_once(
    contact,
    '<form id="contact" name="Contact Us" method="post" action="/thank-you/" netlify-honeypot="bot-field" data-netlify="true">',
    '<form id="contact" name="Contact Us" method="post" action="/thank-you/">\n                        <input type="hidden" name="form-name" value="Contact Us">',
    contact_path,
)
contact = replace_once(
    contact,
    '<div data-netlify-recaptcha="true"></div>',
    '<div class="form-field-group">\n                            <div data-sidequest-turnstile></div>\n                        </div>',
    contact_path,
)
contact = replace_once(
    contact,
    '<link rel="stylesheet" href="/assets/css/contact.css">',
    '<link rel="stylesheet" href="/assets/css/contact.css">\n    <script defer src="/assets/js/form-turnstile.js"></script>',
    contact_path,
)
changes[contact_path] = contact

post_path = "src/_includes/layouts/post.html"
post = read(post_path)
post = replace_once(
    post,
    '<form id="package-inquiry" name="Private Event Package Inquiry" method="post" action="/thank-you/" netlify-honeypot="bot-field" data-netlify="true">',
    '<form id="package-inquiry" name="Private Event Package Inquiry" method="post" action="/thank-you/">\n                        <input type="hidden" name="form-name" value="Private Event Package Inquiry">',
    post_path,
)
post = replace_once(
    post,
    '<div data-netlify-recaptcha="true"></div>',
    '<div class="form-field-group">\n                            <div data-sidequest-turnstile></div>\n                        </div>',
    post_path,
)
post = replace_once(
    post,
    '<link rel="stylesheet" href="/assets/css/events.css">',
    '<link rel="stylesheet" href="/assets/css/events.css">\n\n    {% if \'privateEventPackage\' in tags %}\n        <script defer src="/assets/js/form-turnstile.js"></script>\n    {% endif %}',
    post_path,
)
changes[post_path] = post

base_path = "src/_includes/layouts/base.html"
base = read(base_path)
base = replace_once(
    base,
    "{% if page.url == '/thank-you/' %}",
    "{% if page.url == '/thank-you/' or page.url == '/404.html' %}",
    base_path,
)
changes[base_path] = base

cms_path = "src/admin/config.yml"
cms = read(cms_path)
cms = replace_once(
    cms,
    "site_url: https://sidequesteventsco-prod.netlify.app",
    "site_url: https://sidequesteventsco.com",
    cms_path,
)
changes[cms_path] = cms

redirects_path = "src/_redirects"
redirects = read(redirects_path)
if not (
    "https://sidequesteventsco-prod.netlify.app/*" in redirects
    and "301!" in redirects
    and "/*  /index.html  200" in redirects
):
    raise SystemExit("STOP: existing _redirects differs from the audited version. Nothing edited.")
changes[redirects_path] = """# ============================================
# SideQuest Events page-level redirects
# ============================================
# Format: /old-path/ /new-path/ 301
# Canonical host / HTTPS redirects belong in Cloudflare Domains > Rules > Redirect Rules.
# Do not add a catch-all here; the Worker serves a branded HTTP 404 page.
"""

# All checks pass; write only now, so we avoid partially applied patches.
for relative, content in changes.items():
    (BASE / relative).write_text(content, encoding="utf-8")
    print("Updated:", relative)
print("Done. The new files supplied in this package are already in place.")
