/**
 * Cloudflare form script inclusion at BUILD TIME (no client-side loader).
 * Only generated HTML pages with a <form data-cloudflare-form> receive the script.
 * The rest of the website incurs ZERO form-script requests.
 *
 * Public configuration is in src/config/cloudflare-forms.json.
 */
const settings = require('../cloudflare-forms.json');

function attr(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

module.exports = function cloudflareForms(content) {
  if (!this.page || !this.page.outputPath || !this.page.outputPath.endsWith('.html')) return content;
  // Ignore commented-out form examples when deciding whether the script is necessary.
  const rendered = content.replace(/<!--[\s\S]*?-->/g, '');
  if (!/<form\b[^>]*\bdata-cloudflare-form(?=[\s=/>])/i.test(rendered)) return content;
  if (/<script\b[^>]*\bsrc=["']\/assets\/js\/cloudflare-forms\.js["']/i.test(rendered)) return content;
  if (!/<\/body\s*>/i.test(content)) throw new Error('Cloudflare form page has no closing </body> tag.');
  const { workerUrl, siteKey, turnstileAction } = settings;
  if (!/^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9/_-]+\/?$/.test(workerUrl) ||
      !/^[A-Za-z0-9_-]{15,120}$/.test(siteKey) ||
      !/^[A-Za-z0-9_-]{1,32}$/.test(turnstileAction)) {
    throw new Error('Invalid public Cloudflare form configuration in src/config/cloudflare-forms.json');
  }
  const tag = `<script defer src="/assets/js/cloudflare-forms.js" ` +
    `data-cloudflare-worker-url="${attr(workerUrl)}" ` +
    `data-cloudflare-site-key="${attr(siteKey)}" ` +
    `data-cloudflare-turnstile-action="${attr(turnstileAction)}"></script>`;
  return content.replace(/<\/body\s*>/i, `${tag}\n</body>`);
};
