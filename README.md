# Website development and maintenance

A shared guide for developing, maintaining, and deploying websites built with Eleventy (11ty), Nunjucks, and Node.js. The websites are hosted on Netlify. Where forms are enabled, Cloudflare Workers process submissions, Cloudflare Turnstile provides bot verification, and Resend delivers email notifications. Some projects also use Decap CMS for editable content.

**This README is intentionally identical across repositories.** It describes shared conventions and workflows, not site-specific credentials or assumptions. Always inspect the current repository's files and service dashboards before changing a configuration. Optional features and file paths may vary by project.

## Contents

- [Requirements](#requirements)
- [Get started](#get-started)
- [Daily development workflow](#daily-development-workflow)
- [Project structure](#project-structure)
- [Pages, templates, and content](#pages-templates-and-content)
- [Assets and styling](#assets-and-styling)
- [Decap CMS (where enabled)](#decap-cms-where-enabled)
- [Deployment and hosting](#deployment-and-hosting)
- [Cloudflare Worker form handling](#cloudflare-worker-form-handling)
- [Adding or changing a form](#adding-or-changing-a-form)
- [Testing form notifications safely](#testing-form-notifications-safely)
- [Redirects, domains, and 404 pages](#redirects-domains-and-404-pages)
- [Troubleshooting](#troubleshooting)
- [Security and maintenance](#security-and-maintenance)
- [References](#references)

## Requirements

- Git and access to the relevant GitHub repository.
- Node.js and npm, using a version compatible with the repository's `package.json` and any `.nvmrc`/`engines` settings.
- A code editor and basic familiarity with HTML, CSS, JavaScript, and Git.
- Basic familiarity with Eleventy, Nunjucks, and front matter.
- Access to the project's Netlify account; Cloudflare and Resend access when maintaining form submissions.
- Decap CMS access only for projects that use it.

Do **not** put production API keys, login credentials, or Turnstile secret keys in source code, the README, or Git commits.

## Get started

These commands run in the **repository root** (the folder containing `package.json`).

```bash
# Clone an existing project (replace the URL with this repository's Git URL).
git clone <REPOSITORY_URL>
cd <REPOSITORY_FOLDER>

# See which scripts this specific repository provides.
npm run

# Install exact dependencies when package-lock.json is present.
npm ci

# Start local development if this repository defines a start script.
npm start
```

If `npm start` is not defined, use the appropriate local command shown by `npm run`. Many projects run Eleventy in watch/serve mode, sometimes alongside asset compilation or a local Decap server.

Create a production build using the script defined by this repository:

```bash
npm run build
```

Some builds set `ELEVENTY_ENV=PROD` internally and minify styles, scripts, and markup. The exact build steps are controlled by `package.json` and the Eleventy configuration.

## Daily development workflow

1. Pull the latest changes before starting: `git pull --ff-only origin main` (if the working tree is clean).
2. Edit **source files**, generally under `src/`. Do not manually edit generated files in `public/`.
3. Use shared layouts/components rather than copying common markup into many pages.
4. Run the local development command and check the affected pages at desktop and mobile sizes.
5. Run `npm run build`, review warnings/errors, and inspect generated output when needed.
6. Check changes with `git diff --check` and `git status`.
7. Commit and push. For internal changes, use `YYYYMMDD: Int: Description` (for example, `20261107: Int: Update contact form`).
8. Confirm Netlify has **published** the intended deployment, not merely built it. Check Cloudflare deployments separately when Worker files change.

Example:

```bash
git status
git diff --check
git add -A
git commit -m "YYYYMMDD: Int: Describe change"
git push origin main
```

Avoid including `.DS_Store`, generated caches, API secrets, or unrelated modifications in commits. Never force-push to resolve an ordinary branch mismatch; reconcile remote changes first.

## Project structure

These are **common** paths, not a promise that every repository uses every file:

```text
.
├── src/
│   ├── _data/                 Shared data, when used
│   ├── _includes/             Nunjucks layouts, sections, components
│   ├── admin/                 Decap CMS config and UI, when enabled
│   ├── assets/                Source styles, scripts, images, fonts
│   ├── config/                Eleventy helpers, including conditional forms
│   ├── content/               Pages and CMS-managed content
│   ├── _redirects             Netlify redirect rules, when present
│   ├── index.html             Common homepage entry
│   ├── robots.html            Common robots.txt template
│   └── sitemap.html           Common sitemap.xml template
├── worker/
│   ├── index.js               Reusable Cloudflare form handler, when enabled
│   └── site-config.js         Site-specific Worker settings, when standardized
├── public/                    Generated site output (do not edit)
├── netlify.toml               Netlify build/deploy config, when present
├── wrangler.jsonc             Cloudflare Worker config, when enabled
├── package.json
└── package-lock.json
```

Check the actual structure before following a path. Some projects use a different Eleventy configuration filename, CMS collection directory, or stylesheet layout.

### Key configuration files

| File or directory | Purpose |
| --- | --- |
| `package.json` | npm scripts, dependencies, and build commands. |
| Eleventy configuration (`.eleventy.js`, `eleventy.config.*`, or equivalent) | Inputs, outputs, templating, filters, collections, and passthrough assets. |
| `netlify.toml` | Netlify build/publish settings, plugins, and sometimes redirects. |
| `src/_data/` | Reusable client/site data, if implemented. |
| `src/_includes/` | Shared templates and page layouts. |
| `src/content/` | Pages, posts, or structured content. |
| `src/assets/` | Source assets and compiled intermediates. |
| `src/admin/` | Decap CMS UI and configuration, if installed. |
| `src/_redirects` | Human-authored Netlify redirects; typically copied to `public/_redirects`. |
| `worker/index.js` | Shared form parsing, validation, dynamic display labels, and Resend calls. |
| `worker/site-config.js` | Site-specific domain, approved recipients, sender, endpoint, Turnstile action, and redirect. |
| `src/assets/js/cloudflare-forms.js` | Shared browser integration: automatic Worker endpoint, Turnstile widget and optional field-label metadata. **Loaded only on form pages.** |
| `src/config/cloudflare-forms.json` | Public Worker URL, public Turnstile Site Key, and Turnstile action—configured once per website. |
| `src/config/processors/cloudflareForms.js` | Build-time HTML transform that detects marked forms and injects the shared form script only on those pages. |
| Eleventy configuration file | Registers the `cloudflareForms` transform during site builds. |
| `wrangler.jsonc` | Cloudflare Worker name, entry point, compatibility settings, bindings, and variables. |
| `public/` | Output served by Netlify after a successful build. |

## Pages, templates, and content

Most sites use Nunjucks (`.njk` or `.html` templates) through Eleventy.

- Add a page in the existing `src/content/pages/` convention, with the front matter and layout used by that project.
- Reuse the site's Nunjucks layouts and components. Typical syntax includes `{% extends "layouts/base.html" %}` and `{% include "components/example.html" %}`.
- Set a meaningful `title`, description, and permalink. Add navigation and sitemap metadata using the conventions already present.
- Keep shared client information in data files where possible, so contact details and metadata aren't duplicated.
- Use Eleventy collections or directory data for CMS-generated pages, when applicable.

An illustrative page (adjust keys and paths for the repository):

```njk
---
title: Example page
description: A short description of this page.
permalink: /example/
---

{% extends "layouts/base.html" %}

{% block body %}
  <h1>Example page</h1>
{% endblock %}
```

Do not assume that every site uses automatic navigation or the same `eleventyNavigation` configuration. Inspect existing pages before adding a new one.

## Assets and styling

- Edit the source stylesheet (`.scss`, `.sass`, or the existing source CSS), **not** generated/minified CSS.
- Keep images, icons, fonts, and scripts in the paths used by that repository's build configuration.
- Prefer site-wide variables/tokens and reusable component styles for consistency.
- When changing templates, check script/CSS imports, accessibility labels, responsive behavior, and the production build.
- `public/` is generated output. Rebuilding can overwrite manual changes there.

If an Eleventy build appears stale, inspect the current scripts and then, when appropriate, clear generated state and rebuild:

```bash
rm -rf public .cache
npm run build
```

Only remove directories that are actually generated in that project; do not delete source content or uploaded assets.

## Decap CMS (where enabled)

Decap CMS is an **optional** content editing interface, commonly available at `/admin/`. It may manage posts, jobs, menus, images, or other collections; do not assume every site has a blog.

- The CMS collection definitions usually live in `src/admin/config.yml` or an equivalent configured path.
- The CMS dashboard may be served from `src/admin/index.html`.
- Authentication depends on the project's existing configuration (for example, an approved Git-based gateway); inspect it rather than replacing it with a generic setup.
- Content edits can create commits in GitHub and trigger Netlify deployments. Confirm the new deployment is published.
- If previews or uploads are customized, inspect the corresponding local scripts/styles before editing them.
- **Do not commit** authentication tokens or service credentials to `config.yml` or other source files.

When a CMS edit does not appear on the live site, check the GitHub commit, Netlify build result, and whether **automatic publishing is unlocked**. Re-enable a paused/disabled Netlify project if needed.

## Deployment and hosting

### Netlify: public website

Netlify is the canonical **website host**. Its production deployment is built from GitHub using the repository's `netlify.toml` and/or dashboard configuration. The publish directory is commonly `public/`.

1. Push website changes to the configured production branch.
2. In Netlify, confirm the build succeeded **and the correct deploy is Published**.
3. If updates are not appearing, check whether the project is paused or **automatic publishing is locked**; restore it when appropriate.
4. Verify the primary domain, `www` behavior, key pages, `/admin/` when relevant, and any custom 404 behavior.
5. Preserve existing DNS, mail records, and SSL settings unless a migration specifically calls for changing them.

Do not assume a successful Git push means the current live deployment changed.

### Cloudflare: form processing only

A Cloudflare Worker handles submissions without hosting the website. New Worker-only projects typically use:

- No website build command in Cloudflare.
- Deploy command: `npx wrangler deploy`.
- A `wrangler.jsonc` pointing `main` to `./worker/index.js`, without a static `assets.directory` binding.
- A reachable `<WORKER_NAME>.<ACCOUNT_SUBDOMAIN>.workers.dev` endpoint referenced by forms.

**Older projects may still have Cloudflare Static Assets configured** from a previous website-hosting experiment. Those are transitional implementations, not the desired standard. Do not remove `env.ASSETS` or its binding until the Worker fallback and deployment have been updated together. A legacy Cloudflare deployment may use `npm run build` and `rm -f public/_redirects && npx wrangler deploy` to keep Netlify-specific redirect syntax out of Cloudflare's asset upload.

A Cloudflare deployment and a Netlify deployment are separate. Confirm both as applicable.

## Cloudflare Worker form handling

Forms use a **single dynamic Worker** per website. The shared handler (`worker/index.js`) and browser script (`src/assets/js/cloudflare-forms.js`) are intended to remain identical across websites. The site-specific, server-side details belong in `worker/site-config.js` (apex domain, recipients, agency BCC, permitted HTTPS hostnames, sender, default success path, Turnstile action, and `testMode`). **The routing switch is Git-controlled to prevent Cloudflare dashboard variable edits from accidentally activating an older Worker version.**

### Conditional script inclusion — no per-page work

**Only pages that actually render `<form data-cloudflare-form>` download the Cloudflare form script.** During each Eleventy build, `src/config/processors/cloudflareForms.js` inspects the finished HTML and automatically adds the configured script tag just before `</body>` if such a form exists. Pages without a marked form get no form script tag and make no browser request for it.

The public browser settings are in `src/config/cloudflare-forms.json`:

```json
{
  "workerUrl": "https://WORKER-NAME.ACCOUNT.workers.dev/submit/",
  "siteKey": "PUBLIC_TURNSTILE_SITE_KEY",
  "turnstileAction": "example_form"
}
```

Set this up **once per new site**. These values are public; this is **not** where secrets go. There is no site key, Worker URL, or form-related script tag in the base Nunjucks layout and none are required on individual forms. The transform is registered once in the site's Eleventy config (`.eleventy.js` or equivalent). Nunjucks alone cannot automatically inspect its own final rendered page body, which is why Eleventy's HTML transform is used.

### Secrets and routing

Cloudflare → Workers & Pages → site Worker → Settings → Variables and Secrets:

| Variable | Type | Meaning |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | Authenticates Resend email delivery. |
| `TURNSTILE_SECRET_KEY` | Secret | Server verifies the Turnstile token and the permitted hostname/action. |
**Do not use the dashboard's legacy `TEST_MODE` variable to switch routing.** The shared Worker deliberately ignores it. The per-site, Git-controlled setting is a **single** `"testMode": true` or `false` immediately below `export const SITE = {` at the **top** of `worker/site-config.js`:

```javascript
export const SITE = {
  "testMode": true, // true = testing (agency only); false = production emails
  // Other site-specific settings...
};
```

- `"testMode": true` → **agency inbox only; no client recipients or BCC**.
- `"testMode": false` → configured client recipient(s), with agency BCC.
- If the setting is absent, the shared Worker defaults safely to agency-only.

To set **agency-only test mode** from the repository root (without modifying other files):

```bash
python3 "$HOME/Downloads/dynamic_forms_standard_v7_2/apply_to_repo.py" . --test-only
git add -A && git commit -m "YYYYMMDD: Int: Enable agency-only form testing" && git push origin main
```

After testing, to restore **production notifications**:

```bash
python3 "$HOME/Downloads/dynamic_forms_standard_v7_2/apply_to_repo.py" . --production
git add -A && git commit -m "YYYYMMDD: Int: Enable production form notifications" && git push origin main
```

**Wait for the GitHub-triggered Worker deployment before expecting a mode change.** The Cloudflare dashboard may still show an old `TEST_MODE` text variable; it is intentionally ignored. Leave it unchanged—do not delete or edit it just to clean up the UI, since dashboard variable changes create new Worker versions. This procedure changes one site config file per mode switch, not `worker/index.js`, and does not affect new-form HTML-only authoring. Do not commit secrets, `.dev.vars`, or personal data. Keep `"keep_vars": true` where required to preserve existing dashboard-managed nonsecret bindings; encrypted secrets are preserved by deployments. Verify the active code after Cloudflare dashboard updates to secrets or bindings.

Standard subject: **`[form-subject] | [form-name] | [apex domain]`**. With a hidden value `Form Submission` and form name `Contact Us`, the BM1GC example is `Form Submission | Contact Us | bm1gc.com`. If the hidden prefix is omitted it defaults to `Form Submission`; if the hidden form name is omitted, the browser uses the form's HTML `name` attribute.

The Worker dynamically reads field names, safely escapes values, handles repeated fields/checkbox arrays, formats labels, accepts allowed attachments, and verifies Turnstile server-side. New ordinary forms need **no Worker code edits and no form registration**. Email recipients are never chosen from submitted HTML; they remain server-configured.

## Adding or changing a form

Create ordinary accessible HTML and add **`data-cloudflare-form`** to its `<form>` tag. No `action`, `method`, `enctype`, `data-turnstile-sitekey`, or manually loaded Turnstile script is needed; the reusable browser helper supplies the endpoint, POST and multipart encoding, and injects a Turnstile widget automatically. Existing `[data-turnstile-container]` placeholders are optional and can remain to preserve layout.

```html
<form name="Contact Us" data-cloudflare-form>
  <input type="hidden" name="form-name" value="Contact Us">
  <input type="hidden" name="form-subject" value="Form Submission">

  <label for="contact-name">Your name</label>
  <input id="contact-name" name="fullName" data-email-label="Full name" required>

  <label for="contact-email">Email</label>
  <input id="contact-email" type="email" name="email" data-email-label="Email address" required>

  <label for="contact-message">Message</label>
  <textarea id="contact-message" name="message" data-email-label="Your message" required></textarea>

  <button type="submit">Send</button>
</form>
```

- Every field needs an ordinary `name` to appear in notifications. New names are supported automatically.
- **`data-email-label="Exact email label"` is optional** on inputs, selects, textareas and file inputs. When missing, the Worker makes a human-readable label from the field's `name`. This is *display metadata*, not a field allowlist.
- **Reply-To already works automatically** with the first enabled email input, whatever its `name`; use `data-email-reply-to` on a particular email input only when a form has multiple email addresses.
- Repeated checkbox names (e.g., `interests[]`) are collected without requiring custom JS. Existing checkbox value formatting is preserved.
- For an alternative same-site thank-you page, add `data-cloudflare-success-path="/application-received/"` to the form. The Worker rejects external destinations.
- An optional `[data-turnstile-container]` element allows precise widget placement; otherwise JavaScript inserts a widget container automatically.
- The only settings requiring action for a **new website** are its Worker, domain/host allowlist, sender/recipients, public Turnstile Site Key and action, and Cloudflare secrets. Those are **one-time site setup**, not per-form updates.
- For a form with uploads, add `<input type="file" name="resume" data-email-label="Résumé">`. The shared JS automatically sets multipart form encoding. The Worker validates attachment types and size limits (currently up to three files, 5 MB total) before delivery; test the relevant file type.

**Limitations:** Do not use this generic email form for payment/banking credentials, passwords, PHI, or other regulated data. Required fields rely on browser HTML validation unless a project adds server-side field-specific checks; they cannot be considered protected merely by `required`. Custom server-side validation or different client recipients still requires intentional configuration/code work. No shared error UI is included; on a failed native submission the browser may display the Worker's error response.

### Deploy and test safely

1. Run **the same** `dynamic_forms_standard_v7_2/apply_to_repo.py . --apply` from the repository root. This installs or refreshes the standardized handler, migrates current Worker-backed HTML forms, updates this identical README and sets **one `SITE.testMode=true` at the top of `worker/site-config.js`**. This is agency-only without changing Cloudflare dashboard variables.
2. Run `npm run build`, `git diff --check`, and `git status`. Confirm the expected forms and generated HTML. Then commit/push **all intended local repo changes**: `git add -A`, `git commit -m "YYYYMMDD: Int: Standardize dynamic Cloudflare forms"`, `git push origin main`.
3. Confirm both Netlify website deploy and Cloudflare Worker deploy are successful. On Cloudflare's **Deployments** page, ensure the latest Git build is the active Worker—not merely Ready in history.
4. Submit a live test for **each** form, including lightboxes, checkbox arrays, and uploads. Agency should receive it; **no client To/BCC**. Verify the three-part subject, Reply-To, labels, Turnstile, attachments, and redirect.
5. Run `python3 "$HOME/Downloads/dynamic_forms_standard_v7_2/apply_to_repo.py" . --production` and push another Git commit. This changes **only** `worker/site-config.js` to `"testMode": false`. Confirm GitHub deployed the current source version; production To is the approved client and BCC is agency.
6. Do **not** toggle `TEST_MODE` in Cloudflare's dashboard. Dashboard variable edits create separate Worker versions and have caused source/version mismatches during migrations. The dashboard's existing `TEST_MODE` entry is ignored by this version of the handler. Leave it alone.
7. Disable Netlify Form detection only if no forms still rely on Netlify; preserve historical submissions. Do not change Netlify, DNS, or Decap just because of this form change.

## Testing form notifications safely

The agency-only mode takes effect **after its Worker Git deployment**. Real leads submitted during that test window route to the agency instead of the client, so complete testing promptly. If a previous live deployment is still active, do not presume agency-only safety until the new Worker is confirmed active.

A `415 Unsupported form submission` on a normal browser submission with `multipart/form-data` often indicates the *old Worker code* is active. Check **Cloudflare → Worker → Edit code** for `multipart/form-data` and `form-field-labels`; the new shared Worker recognizes both. Inspect deployment history if GitHub built new code but a dashboard settings change made an older version active. Rollback is a recovery tool, not the normal deployment workflow.

Site owners may have independent inbox automation (for example, a Gmail Apps Script that filters notifications by sender, subject, or Reply-To). Migrating from Netlify emails to Resend changes the notification sender/subject. Audit and update those integrations before enabling client notifications; do not assume an email delivery test also proves auto-replies are working. An automation should process each notification message once, avoid replying to internal senders, and never fall back to the notification sender when Reply-To is missing.

## Redirects, domains, and 404 pages

Netlify rules generally live in `src/_redirects` and are published as `public/_redirects`. Preserve existing SEO redirects and any legacy-domain rules.

- A `301` is a permanent redirect; Netlify's `301!` forces it even if the source URL would otherwise resolve.
- For sites requiring a Netlify preview-domain redirect, add a host-specific rule redirecting `<SITE>.netlify.app/*` to the production apex. The live site's primary-domain setting alone may not reproduce a previously custom-configured redirect.
- Keep existing `www`/apex rules and external legacy-domain redirects, where applicable.
- A catch-all `/* /index.html 200` is an **SPA rewrite**, not a custom 404 rule. Use it only if the site's routing architecture requires it.
- If the build publishes `public/404.html`, Netlify can serve it automatically for nonexistent URLs with HTTP 404; the browser URL generally remains the missing URL.
- Do not blindly replace `_redirects` when adding a domain rule. Redirect order matters.
- Cloudflare Static Assets does **not** accept all Netlify `_redirects` syntax. Keep these rules in Netlify's output, not a legacy Cloudflare static-asset upload.

Domain DNS and registrar settings are separate from form handling. **Do not change DNS or nameservers merely to connect a Worker through `workers.dev`.** Preserve mail-related records.

## Troubleshooting

| Symptom | Check first |
| --- | --- |
| Git push succeeds but live site is unchanged | Netlify latest deploy, **Published** status, automatic publishing lock, project paused/disabled. |
| Netlify deploy builds but a page is 404 | Front matter, permalink, Eleventy output, `public/` contents, and `_redirects`. |
| Missing page returns homepage with HTTP 200 | Look for an unintended `/* /index.html 200` SPA catch-all. |
| Preview domain does not redirect to apex | Check host-specific rules in `_redirects` and published deploy. |
| Form says `403 Forbidden` | Worker origin allowlist; Turnstile site key/secret, verified hostname/action, expired token. |
| Form returns `415 Unsupported form submission` | Check submitted `Content-Type` in browser network headers. If it is `multipart/form-data`, verify the **active** Worker code is the new shared handler, not an older version restored by a dashboard configuration change. |
| Form returns 502 or email is absent | Check Cloudflare Worker logs, Resend API response/status, and secrets; do not log submitted private data. |
| Turnstile shows widget but Siteverify warning | Confirm the live Worker calls Siteverify on a completed submission; inspect Turnstile analytics and deployed code. |
| Emails reach agency but not client | Check Git-controlled `worker/site-config.js` `testMode`, latest active Cloudflare deployment, and Resend recipient/BCC fields. |
| Cloudflare deploy rejects `_redirects` | Legacy static-assets build is reading Netlify redirect rules; review the deployed build command and remove `public/_redirects` from Cloudflare's temporary build output only. |
| CMS edits don't appear | CMS commit, GitHub branch, Netlify build/publish status, and authentication configuration. |
| Stale local pages/styles | Confirm you're editing `src/`, clear generated output/cache if appropriate, and rebuild. |

## Security and maintenance

- Keep dependencies current through controlled updates and testing; do not blindly update all packages during an urgent production fix.
- Review security headers, accessible labels, validation, spam controls, and rate limits when adding forms.
- Keep approved hostnames, request methods, and endpoint paths restricted in Workers.
- Always validate Turnstile tokens server-side; frontend completion alone is insufficient.
- Never commit `.env`, `.dev.vars`, API keys, passwords, or sensitive submissions. Check `.gitignore` and Git history before pushing.
- Avoid logging full form payloads, résumés, sensitive details, or credentials in Worker logs.
- Preserve historical Netlify submissions, legitimate DNS records, and CMS configuration when retiring unused functionality.
- Verify Netlify HTTPS/SSL and domain behavior periodically, including renewal warnings.
- Record external service ownership and access outside this generic README (for example, in the team's private password manager or project inventory).

## References

- [Eleventy documentation](https://www.11ty.dev/docs/)
- [Nunjucks templating](https://mozilla.github.io/nunjucks/templating.html)
- [Decap CMS documentation](https://decapcms.org/docs/intro/)
- [Netlify documentation](https://docs.netlify.com/)
- [Netlify redirects](https://docs.netlify.com/manage/routing/redirects/overview/)
- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Cloudflare Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Resend documentation](https://resend.com/docs/)

---

**Maintenance rule:** Keep this README consistent across repositories. Document truly site-specific values (domains, recipients, form subjects, and special integrations) in a private project inventory or a separately maintained project-specific file. Never assume that updating this README changes deployed Worker or form behavior.
