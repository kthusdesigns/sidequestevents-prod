/**
 * Cloudflare Forms shared browser helper (v3).
 * Loaded only on pages with data-cloudflare-form by an Eleventy HTML transform.
 * Public site settings are configured once in src/config/cloudflare-forms.json.
 * Future forms: <form data-cloudflare-form> + form-name + optional form-subject.
 * No per-form site key, URL, or JavaScript required.
 * The public site key belongs in the base layout, NOT in worker/site-config.js.
 */
(() => {
  'use strict';
  const script = document.currentScript;
  if (!script) return;
  const workerUrl = script.getAttribute('data-cloudflare-worker-url') || '';
  const siteKey = script.getAttribute('data-cloudflare-site-key') || '';
  const action = script.getAttribute('data-cloudflare-turnstile-action') || '';
  const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_.\[\]-]{0,79}$/;
  const META_FIELD = 'form-field-labels';
  const REPLY_FIELD = 'form-reply-to-field';
  const registered = new WeakSet();
  let turnstilePromise = null;

  function loadTurnstile() {
    if (window.turnstile?.render) return Promise.resolve(window.turnstile);
    if (turnstilePromise) return turnstilePromise;
    turnstilePromise = new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      tag.async = true;
      tag.onload = () => window.turnstile?.render
        ? resolve(window.turnstile) : reject(new Error('Turnstile did not initialize'));
      tag.onerror = () => reject(new Error('Turnstile could not load'));
      document.head.appendChild(tag);
    });
    return turnstilePromise;
  }

  function addMetadata(form) {
    form.addEventListener('formdata', ({ formData }) => {
      const labels = Object.create(null);
      for (const field of form.querySelectorAll('input[data-email-label], select[data-email-label], textarea[data-email-label]')) {
        const name = field.name;
        const label = field.getAttribute('data-email-label')?.trim();
        if (!name || !FIELD_NAME.test(name) || field.disabled || !formData.has(name) ||
            !label || label.length > 120 || /[\x00-\x1F\x7F<>]/.test(label) ||
            !/^[\p{L}\p{N}]/u.test(label) || Object.hasOwn(labels, name)) continue;
        labels[name] = label;
      }
      if (Object.keys(labels).length) formData.set(META_FIELD, JSON.stringify(labels));
      // Optional same-site thank-you path, validated again by the Worker.
      const success = form.getAttribute('data-cloudflare-success-path');
      if (success) formData.set('form-success', success);
      // The ordinary form name can stand in for a hidden form-name field.
      if (!formData.has('form-name') && form.name) formData.set('form-name', form.name);
      // Honor a designated email input; otherwise use the first enabled email input.
      const emailInput = form.querySelector('input[type="email"][data-email-reply-to][name]:not([disabled])') ||
        form.querySelector('input[type="email"][name]:not([disabled])');
      if (emailInput && FIELD_NAME.test(emailInput.name) && formData.has(emailInput.name)) {
        formData.set(REPLY_FIELD, emailInput.name);
      }
    });
  }

  function register(form) {
    if (registered.has(form)) return;
    registered.add(form);
    addMetadata(form);
    if (!workerUrl || !/^https:\/\/[^\s/]+\/.+/.test(workerUrl) || !siteKey || !action) {
      console.error('Cloudflare Forms: missing endpoint, public site key, or Turnstile action in site configuration.');
      form.addEventListener('submit', event => event.preventDefault());
      return;
    }

    // These attributes can still be supplied in HTML, but aren't required.
    form.action = workerUrl;
    form.method = 'post';
    form.enctype = 'multipart/form-data';

    const button = form.querySelector('button[type="submit"], input[type="submit"]');
    if (button) button.disabled = true;
    let tokenReady = false;
    form.addEventListener('submit', event => {
      if (!tokenReady) event.preventDefault();
    });

    // Reuse the existing site's widget container if present; otherwise insert one.
    let container = form.querySelector('[data-turnstile-container]');
    if (!container) {
      container = document.createElement('div');
      container.setAttribute('data-turnstile-container', '');
      container.style.minHeight = '65px';
      if (button) button.parentNode.insertBefore(container, button);
      else form.appendChild(container);
    }

    loadTurnstile().then(turnstile => {
      turnstile.render(container, {
        sitekey: siteKey,
        action,
        'response-field-name': 'cf-turnstile-response',
        callback: token => { tokenReady = !!token; if (button) button.disabled = !tokenReady; },
        'expired-callback': () => { tokenReady = false; if (button) button.disabled = true; },
        'timeout-callback': () => { tokenReady = false; if (button) button.disabled = true; },
        'error-callback': () => { tokenReady = false; if (button) button.disabled = true; }
      });
    }).catch(() => {
      container.textContent = 'Verification could not load. Please refresh this page.';
    });
  }

  function scan() {
    document.querySelectorAll('form[data-cloudflare-form]').forEach(register);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();
})();
