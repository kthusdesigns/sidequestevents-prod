/**
 * Shared form-to-email Worker (v1.3 — dynamic forms, Git-controlled notification routing).
 * Keep this file IDENTICAL across sites. All site differences belong in site-config.js.
 * New form names and new fields require no Worker changes.
 * Do not use for card details, bank data, PHI, or other regulated data.
 */
import { SITE } from './site-config.js';

const LABELS_FIELD = 'form-field-labels';
const OMIT = new Set(['form-name', 'form-subject', 'form-success', 'bot-field', 'cf-turnstile-response', 'form-reply-to-field', LABELS_FIELD]);
const MAX_BODY_BYTES = 7 * 1024 * 1024;
const MAX_FIELD_COUNT = 80;
const MAX_TEXT_BYTES = 32_000;
const MAX_FILE_COUNT = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ALL_FILES_BYTES = 5 * 1024 * 1024;
const FILE_TYPES = new Set(['pdf', 'doc', 'docx', 'txt', 'rtf', 'jpg', 'jpeg', 'png', 'webp', 'csv', 'xlsx']);

const fail = (message, status) => new Response(message, {
  status,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
});

const escaped = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);

const safeName = value => typeof value === 'string' &&
  value.length > 0 && value.length <= 100 &&
  !/[\r\n\x00-\x1F\x7F<>]/.test(value) &&
  /^[\p{L}\p{N}]/u.test(value);

const byteLength = s => new TextEncoder().encode(s).byteLength;

// Labels are optional display metadata sent by the single reusable browser helper.
// They never control recipients, sender, redirects, headers, or verified field values.
function readLabels(formData) {
  const raw = formData.get(LABELS_FIELD);
  const labels = new Map();
  if (raw == null) return labels;
  if (typeof raw !== 'string' || raw.length > 12_000 || !raw) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return null;
  const items = Object.entries(parsed);
  if (items.length > MAX_FIELD_COUNT) return null;
  for (const [key, val] of items) {
    if (!/^[A-Za-z][A-Za-z0-9_.\[\]-]{0,79}$/.test(key) || OMIT.has(key) ||
      typeof val !== 'string' || val.length > 120 || val.length === 0 ||
      val.trim() !== val || !/^[\p{L}\p{N}]/u.test(val) ||
      /[\x00-\x1F\x7F<>]/.test(val)) return null;
    labels.set(key, val);
  }
  return labels;
}

function niceLabel(key) {
  // Generic fallback, with no per-field names to maintain.
  const original = key.replace(/\[\]$/, '');
  return original.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^./, c => c.toUpperCase());
}

function notification(entries, attachments, labels) {
  const labelFor = key => labels.get(key) || niceLabel(key);
  const itemTexts = entries.map(([name, values]) => [labelFor(name),
    name.endsWith('[]') || values.length > 1 ? JSON.stringify(values.filter(Boolean)) : (values[0] || '')]);
  const fileNotes = attachments.map(file => [`Attachment: ${labelFor(file.field)}`, file.filename]);
  const all = [...itemTexts, ...fileNotes];
  const text = all.map(([label, value]) => `${label}:\n${value}`).join('\n\n');
  const htmlRows = all.map(([label, value]) =>
    `<div style="margin:0 0 24px"><div style="font-weight:600">${escaped(label)}</div>` +
    `<div style="white-space:pre-wrap">${escaped(value)}</div></div>`).join('');
  return { text,
    html: '<!doctype html><html lang="en"><head><meta charset="utf-8"></head>' +
      `<body style="margin:0;padding:24px;color:#222;font:14px/1.5 Arial,Helvetica,sans-serif">${htmlRows}</body></html>`
  };
}

function safeRedirect(formData) {
  const path = String(formData.get('form-success') || SITE.successPath);
  // On-site paths only. An external target or //host must NEVER be accepted.
  if (!/^\/(?!\/)[A-Za-z0-9_\/.-]*\/?$/.test(path) || path.includes('..') || path.includes('\\')) return null;
  return new URL(path, `https://${SITE.domain}`).href;
}

function validOrigin(request) {
  const raw = request.headers.get('Origin');
  if (!raw) return { ok: true, hostname: null }; // Siteverify hostname remains mandatory.
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || parsed.port ||
        !SITE.allowedHosts.includes(parsed.hostname) || parsed.origin !== raw) {
      return { ok: false };
    }
    return { ok: true, hostname: parsed.hostname };
  } catch { return { ok: false }; }
}

async function verifyTurnstile(request, env, token, originHostname) {
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET_KEY, response: token,
      remoteip: request.headers.get('CF-Connecting-IP') || undefined
    })
  });
  if (!res.ok) throw new Error('Turnstile service unavailable');
  const data = await res.json();
  return data.success === true && data.action === SITE.turnstileAction &&
    SITE.allowedHosts.includes(data.hostname) &&
    (!originHostname || data.hostname === originHostname);
}

function asBase64(bytes) {
  let result = '';
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    result += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(result);
}

function emailField(entries, requestedField) {
  // The shared browser script selects the first <input type="email">, regardless of name.
  // Fall back to conventional field names for existing native / non-JS forms.
  const field = requestedField || entries.find(([key]) => /email/i.test(key))?.[0];
  if (!field) return {};
  if (!/^[A-Za-z][A-Za-z0-9_.\[\]-]{0,79}$/.test(field)) return { invalid: true };
  const values = entries.find(([key]) => key === field)?.[1];
  if (!values) return { invalid: true };
  const value = values.find(Boolean) || '';
  if (!value) return {};
  if (value.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) return { invalid: true };
  return { value };
}

function safeSubject(formData, formName) {
  const rawPrefix = formData.get('form-subject');
  if (rawPrefix !== null && typeof rawPrefix !== 'string') return null;
  const prefix = rawPrefix === null ? 'Form Submission' : rawPrefix.trim();
  // Exactly three segments. Disallow separators inside the user-supplied segments.
  if (!safeName(prefix) || prefix.includes('|') || formName.includes('|')) return null;
  return `${prefix} | ${formName} | ${SITE.domain}`;
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname !== SITE.postPath || request.method !== 'POST') return fail('Not found', 404);
    const origin = validOrigin(request);
    if (!origin.ok) return fail('Forbidden', 403);
    const type = (request.headers.get('Content-Type') || '').toLowerCase();
    if (!type.includes('application/x-www-form-urlencoded') && !type.includes('multipart/form-data')) {
      return fail('Unsupported form submission', 415);
    }
    const declared = Number(request.headers.get('Content-Length') || '0');
    if (declared > MAX_BODY_BYTES) return fail('Submission too large', 413);
    let form;
    try {
      const body = await request.arrayBuffer();
      if (body.byteLength > MAX_BODY_BYTES) return fail('Submission too large', 413);
      form = await new Request(request.url, {
        method: 'POST', headers: { 'Content-Type': request.headers.get('Content-Type') }, body
      }).formData();
    } catch { return fail('Invalid form data', 400); }

    // Honeypot: return the ordinary success destination without delivering email.
    const successUrl = safeRedirect(form);
    if (!successUrl) return fail('Invalid success destination', 400);
    if (form.get('bot-field')) return Response.redirect(successUrl, 303);
    const formName = String(form.get('form-name') || '').trim();
    if (!safeName(formName)) return fail('Invalid form name', 400);
    const subject = safeSubject(form, formName);
    if (!subject) return fail('Invalid form subject', 400);
    const labels = readLabels(form);
    if (!labels) return fail('Invalid field label metadata', 400);

    const values = new Map();
    const files = [];
    let count = 0, textBytes = 0, fileBytes = 0;
    for (const [field, value] of form.entries()) {
      if (OMIT.has(field)) continue;
      if (!/^[A-Za-z][A-Za-z0-9_.\[\]-]{0,79}$/.test(field)) return fail('Invalid field name', 400);
      if (++count > MAX_FIELD_COUNT) return fail('Too many fields', 413);
      if (typeof value !== 'string') {
        if (value.size === 0 && !value.name) continue;
        const filename = (value.name || '').split(/[\\/]/).pop();
        const ext = filename.split('.').pop().toLowerCase();
        if (!filename || filename.length > 140 || /[\x00-\x1F\x7F<>]/.test(filename) ||
            !FILE_TYPES.has(ext) || value.size === 0 || value.size > MAX_FILE_BYTES) {
          return fail('Unsupported attachment', 400);
        }
        fileBytes += value.size;
        if (files.length >= MAX_FILE_COUNT || fileBytes > MAX_ALL_FILES_BYTES) return fail('Attachments too large', 413);
        files.push({ field, filename, file: value });
      } else {
        const val = value.trim();
        textBytes += byteLength(val);
        if (byteLength(val) > 10_000 || textBytes > MAX_TEXT_BYTES) return fail('Form text too large', 413);
        if (!values.has(field)) values.set(field, []);
        values.get(field).push(val);
      }
    }
    if (!values.size && !files.length) return fail('Please complete the form', 400);
    const replyToField = form.get('form-reply-to-field');
    if (replyToField !== null && (typeof replyToField !== 'string' || replyToField.length > 80)) {
      return fail('Invalid reply-to field', 400);
    }
    const email = emailField([...values], replyToField);
    if (email.invalid) return fail('Invalid email address', 400);
    if (!env.RESEND_API_KEY || !env.TURNSTILE_SECRET_KEY) return fail('Form service not configured', 503);

    let verified;
    try { verified = await verifyTurnstile(request, env, form.get('cf-turnstile-response'), origin.hostname); }
    catch { console.error('Turnstile verification failed'); return fail('Security verification unavailable', 502); }
    if (!verified) return fail('Security verification failed or expired', 403);

    const attachmentPayload = [];
    for (const item of files) {
      attachmentPayload.push({ filename: item.filename,
        content: asBase64(new Uint8Array(await item.file.arrayBuffer())) });
    }
    const content = notification([...values], files, labels);
    // Agency-only testing MUST NEVER send or BCC a client.
    const testMode = SITE.testMode !== false; // Git-controlled. Dashboard TEST_MODE is intentionally ignored.
    const payload = {
      from: SITE.from,
      to: testMode ? [SITE.agency] : SITE.recipients,
      ...(testMode ? {} : { bcc: [SITE.agency] }),
      ...(email.value ? { reply_to: email.value } : {}),
      subject, text: content.text, html: content.html,
      ...(attachmentPayload.length ? { attachments: attachmentPayload } : {})
    };
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) { console.error('Resend rejected submission', res.status); return fail('Unable to send your request', 502); }
      return Response.redirect(successUrl, 303);
    } catch {
      console.error('Resend request failed');
      return fail('Unable to send your request', 502);
    }
  }
};
