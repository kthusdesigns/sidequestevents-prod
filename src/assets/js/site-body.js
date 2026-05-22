/**
 * site-body.js
 * Centralized site behavior + lazy-loaded third-party scripts
 * Safe to load with: <script defer src="/assets/js/site.js"></script>
 */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------
   * 1. Scroll state handler (rAF-throttled, passive)
   * ------------------------------------------------------------------- */

  (function () {
    let ticking = false;
    const docEl = document.documentElement;
    const body = document.body;

    document.addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          window.requestAnimationFrame(function () {
            body.classList.toggle('scroll', docEl.scrollTop >= 24);
            ticking = false;
          });
          ticking = true;
        }
      },
      { passive: true }
    );
  })();
})();