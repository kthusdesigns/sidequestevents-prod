// SideQuest Events — Cloudflare form handler.
// Handles both Contact Us and CMS-generated Private Event Package Inquiry forms.
// Email subjects, field order and labels match the supplied Netlify notifications.
const SUCCESS_PATH = "/thank-you/";
const NOTIFICATION_TO = ["hello@sidequesteventsco.com"];
const NOTIFICATION_BCC = ["hello@kthusdesigns.com"];
const FROM = "sidequesteventsco.com <forms@notifications.kthusdesigns.com>";
const TURNSTILE_ACTION = "sidequest_form";

const FORMS = {
  "Contact Us": {
    subject: "Form Submission | Contact Us | sidequesteventsco.com",
    entries: [
      ["First Name", "firstName"],
      ["Last Name", "lastName"],
      ["Email", "email"],
      ["Phone Number", "phoneNumber"],
      ["Topic", "topic"],
      ["Message", "message"]
    ]
  },
  "Private Event Package Inquiry": {
    subject: "Private Event Package Inquiry | sidequesteventsco.com",
    entries: [
      ["Package", "package"],
      ["First Name", "firstName"],
      ["Last Name", "lastName"],
      ["Email", "email"],
      ["Phone Number", "phoneNumber"],
      ["Desired Date", "desiredDate"],
      ["Desired Time", "desiredTime"],
      ["Guest Count", "guestCount"],
      ["Message", "message"]
    ]
  }
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function formatNotification(fields, entries) {
  const text = entries
    .map(([label, key]) => `${label}:\n${fields[key] || ""}`)
    .join("\n\n");

  const htmlContent = entries.map(([label, key]) => {
    const value = fields[key] || "";
    let formatted = escapeHtml(value).replace(/\r?\n/g, "<br>");

    if (key === "email") {
      formatted = `<a href="mailto:${escapeHtml(value)}" style="color:#1a73e8;text-decoration:underline;">${escapeHtml(value)}</a>`;
    } else if (key === "phoneNumber") {
      const phoneHref = value.replace(/[^\d+]/g, "");
      formatted = `<a href="tel:${escapeHtml(phoneHref)}" style="color:#1a73e8;text-decoration:underline;">${escapeHtml(value)}</a>`;
    }

    return `<div style="margin:0 0 28px;"><div>${escapeHtml(label)}:</div><div>${formatted}</div></div>`;
  }).join("");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#fff;color:#202124;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;">${htmlContent}</body></html>`;
  return { text, html };
}

function denverDatePlus14() {
  // Calendar-day comparison in the business's local timezone, including DST.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = (type) => Number(parts.find((item) => item.type === type).value);
  const minimumDate = new Date(Date.UTC(part("year"), part("month") - 1, part("day") + 14));
  return minimumDate.toISOString().slice(0, 10);
}

function getFields(form, formName) {
  const fields = {};
  for (const [, key] of FORMS[formName].entries) {
    fields[key] = (form.get(key) || "").trim();
  }
  return fields;
}

function validateFields(fields, formName) {
  const required = ["firstName", "lastName", "email", "phoneNumber"];
  if (formName === "Contact Us") required.push("topic", "message");
  else required.push("package", "desiredDate", "desiredTime", "guestCount");

  if (required.some((key) => !fields[key])) return false;
  if (fields.firstName.length > 120 || fields.lastName.length > 120) return false;
  if (fields.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return false;
  if (fields.phoneNumber.length > 50 || !/^[\d\s()+.\-]+$/.test(fields.phoneNumber)) return false;
  if (fields.message.length > 5000) return false;

  if (formName === "Contact Us") {
    return [
      "Vendor application", "Private event inquiry", "Event sponsorship",
      "General question", "Other"
    ].includes(fields.topic);
  }

  if (fields.package.length > 300) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.desiredDate)) return false;
  const selectedDate = new Date(`${fields.desiredDate}T00:00:00Z`);
  if (!Number.isFinite(selectedDate.valueOf())) return false;
  if (selectedDate.toISOString().slice(0, 10) !== fields.desiredDate) return false;
  // ISO date strings sort chronologically and this enforces the existing 14-day rule.
  if (fields.desiredDate < denverDatePlus14()) return false;
  if (!["Up to 10 Guests", "11-20 Guests", "21-30 Guests", "31-40 Guests", "41-50 Guests", "50+ Guests"].includes(fields.guestCount)) return false;
  const validTimes = [];
  for (let minutes = 6 * 60; minutes <= 23 * 60; minutes += 30) {
    const hour = Math.floor(minutes / 60);
    const minute = String(minutes % 60).padStart(2, "0");
    validTimes.push(`${hour % 12 || 12}:${minute} ${hour < 12 ? "AM" : "PM"}`);
  }
  return validTimes.includes(fields.desiredTime);
}

async function verifyTurnstile(request, env, token) {
  if (!token || token.length > 2048) return false;

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: request.headers.get("CF-Connecting-IP") || undefined
    })
  });

  if (!response.ok) throw new Error("Turnstile validation service unavailable");
  const result = await response.json();
  return result.success === true &&
    result.hostname === new URL(request.url).hostname &&
    result.action === TURNSTILE_ACTION;
}

const redirectToSuccess = (request) => Response.redirect(new URL(SUCCESS_PATH, request.url), 303);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== SUCCESS_PATH || request.method !== "POST") {
      return env.ASSETS.fetch(request);
    }

    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return new Response("Forbidden", { status: 403 });

    const contentType = (request.headers.get("Content-Type") || "").toLowerCase();
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      return new Response("Unsupported form submission", { status: 415 });
    }

    const declaredLength = Number(request.headers.get("Content-Length") || "0");
    if (declaredLength > 12000) return new Response("Submission too large", { status: 413 });
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 12000) {
      return new Response("Submission too large", { status: 413 });
    }
    const form = new URLSearchParams(raw);
    if (form.get("bot-field")) return redirectToSuccess(request);

    const formName = form.get("form-name");
    if (!Object.hasOwn(FORMS, formName || "")) {
      return new Response("Unknown form", { status: 400 });
    }

    const fields = getFields(form, formName);
    if (!validateFields(fields, formName)) {
      return new Response("Please check your form fields.", { status: 400 });
    }
    if (!env.RESEND_API_KEY || !env.TURNSTILE_SECRET_KEY) {
      return new Response("Form service not configured", { status: 503 });
    }

    let verified;
    try {
      verified = await verifyTurnstile(request, env, form.get("cf-turnstile-response"));
    } catch {
      console.error("Turnstile verification request failed");
      return new Response("Verification is temporarily unavailable. Please try again.", { status: 502 });
    }
    if (!verified) {
      return new Response("Security verification expired or failed. Please refresh and try again.", { status: 403 });
    }

    const notification = formatNotification(fields, FORMS[formName].entries);
    const email = {
      from: FROM,
      to: NOTIFICATION_TO,
      bcc: NOTIFICATION_BCC,
      reply_to: fields.email,
      subject: FORMS[formName].subject,
      text: notification.text,
      html: notification.html
    };

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(email)
      });
      if (!response.ok) {
        console.error("Resend email failed:", response.status);
        return new Response("Unable to send your request. Please try again later.", { status: 502 });
      }
      return redirectToSuccess(request);
    } catch {
      console.error("Resend request failed");
      return new Response("Unable to send your request. Please try again later.", { status: 502 });
    }
  }
};
