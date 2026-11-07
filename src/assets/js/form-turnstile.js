// A single Turnstile widget is used on the Contact Us page and on all
// Decap-generated private-event package pages. The API loads near the form.
(function () {
  const container = document.querySelector("[data-sidequest-turnstile]");
  if (!container) return;

  // Paste the PUBLIC site key of your SideQuest Turnstile widget here.
  // The PRIVATE secret key belongs only in the Cloudflare dashboard.
  const SITE_KEY = "REPLACE_WITH_SIDEQUEST_TURNSTILE_SITE_KEY";
  let loaded = false;

  function loadTurnstile() {
    if (loaded) return;
    loaded = true;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = function () {
      if (window.turnstile) {
        window.turnstile.render(container, {
          sitekey: SITE_KEY,
          action: "sidequest_form",
          theme: "auto"
        });
      }
    };
    document.head.appendChild(script);
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting; })) {
        observer.disconnect();
        loadTurnstile();
      }
    }, { rootMargin: "400px 0px" });
    observer.observe(container);
  } else {
    loadTurnstile();
  }
})();
