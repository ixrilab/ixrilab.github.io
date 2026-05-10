/* ===========================================================
   IXRI Lab — Hero intro animation
   - Mirrors the original sequence and timing (typewriter 45ms,
     untype 35ms, full ~7s timeline)
   - The only changes from the original are jank fixes:
       (1) `.compact` width animation is replaced by a FLIP transform
           transition (no layout reflow during the shrink)
       (2) #heroH1 max-width animation is replaced by opacity +
           translateY (no layout reflow during the reveal)
   - Waits for fonts to be ready so getBBox() returns correct values
   - Honors prefers-reduced-motion (jumps to final state)
   =========================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var heroIntro = $('heroIntro');
  var logoAnim  = $('logoAnim');
  var svg = $('animSvg');
  var bL = $('bL'), bR = $('bR'), gL = $('gL'), gR = $('gR');
  var c1 = $('c1'), c2 = $('c2');
  var tL1 = $('tL1'), tL2 = $('tL2'), tR1 = $('tR1'), tR2 = $('tR2');
  var heroH1 = $('heroH1');
  var heroContent = document.querySelector('.hero-content');
  if (!bL || !svg) return;

  var prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Curve dash setup --- */
  var len1 = c1.getTotalLength(), len2 = c2.getTotalLength();
  c1.style.strokeDasharray = len1; c1.style.strokeDashoffset = len1;
  c2.style.strokeDasharray = len2; c2.style.strokeDashoffset = len2;

  /* --- Bar transform setup --- */
  var BAR_W = 49, BAR_H = 365;
  var BL_CX = 89  + BAR_W / 2, BL_CY = 117 + BAR_H / 2;
  var BR_CX = 442 + BAR_W / 2, BR_CY = 117 + BAR_H / 2;
  bL.style.transformBox = 'fill-box'; bL.style.transformOrigin = 'center center';
  bR.style.transformBox = 'fill-box'; bR.style.transformOrigin = 'center center';

  /* --- Original helpers (kept verbatim where possible) --- */
  function fade(el, to, dur) {
    el.style.transition = 'opacity ' + dur + 'ms ease';
    el.setAttribute('opacity', String(to));
  }
  function draw(el, dur) {
    el.setAttribute('opacity', '1');
    el.style.transition = 'stroke-dashoffset ' + dur + 'ms cubic-bezier(0.32,0.08,0.24,1)';
    el.style.strokeDashoffset = '0';
  }
  function typeText(el, text, d, cb) {
    el.setAttribute('opacity', '1');
    el.textContent = '';
    var i = 0;
    (function n() {
      if (i < text.length) { el.textContent += text[i]; i++; setTimeout(n, d); }
      else if (cb) cb();
    })();
  }
  function unTypeText(el, d, k, cb) {
    var t = el.textContent, i = t.length;
    (function n() {
      if (i > k) { i--; el.textContent = t.substring(0, i); setTimeout(n, d); }
      else if (cb) cb();
    })();
  }

  /* --- Final-state shortcut for reduced motion --- */
  function jumpToFinalState() {
    [tL1, tL2, tR1, tR2].forEach(function (t) {
      t.style.transition = '';
      t.setAttribute('opacity', '0');
    });
    bL.setAttribute('opacity', '0');
    bR.setAttribute('opacity', '0');
    gL.setAttribute('opacity', '1');
    gR.setAttribute('opacity', '1');
    c1.setAttribute('opacity', '1'); c1.style.strokeDashoffset = '0';
    c2.setAttribute('opacity', '1'); c2.style.strokeDashoffset = '0';
    logoAnim.classList.add('compact');
    if (heroH1) heroH1.classList.add('visible');
    if (heroContent) heroContent.classList.add('visible');
  }

  /* --- FLIP-based compact: visually identical to the old width
         transition, but uses transform so there is zero layout
         reflow during the animation. --- */
  function compactWithFLIP(dur) {
    var first = logoAnim.getBoundingClientRect();
    logoAnim.classList.add('compact');
    var last = logoAnim.getBoundingClientRect();
    var dx = first.left - last.left;
    var dy = first.top - last.top;
    var sx = first.width  / Math.max(last.width,  1);
    var sy = first.height / Math.max(last.height, 1);

    logoAnim.style.transformOrigin = 'top left';
    logoAnim.style.transform =
      'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')';
    logoAnim.style.willChange = 'transform';

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        logoAnim.style.transition = 'transform ' + dur + 'ms cubic-bezier(0.32,0.08,0.24,1)';
        logoAnim.style.transform = 'none';
        setTimeout(function () {
          logoAnim.style.transition = '';
          logoAnim.style.willChange = '';
        }, dur + 30);
      });
    });
  }

  /* --- Run! Wait for fonts so getBBox is accurate. --- */
  if (prefersReducedMotion) { jumpToFinalState(); return; }

  var fontsReady = (document.fonts && document.fonts.ready)
    ? document.fonts.ready
    : Promise.resolve();

  fontsReady.then(runSequence).catch(function () { jumpToFinalState(); });

  function runSequence() {
    /* 0.3s — type "Human" then (after 80ms gap) "Intelligence" on the left */
    setTimeout(function () {
      typeText(tL1, 'Human', 45, function () {
        setTimeout(function () { typeText(tL2, 'Intelligence', 45); }, 80);
      });
    }, 300);

    /* 1.0s — type "Artificial" then "Intelligence" on the right */
    setTimeout(function () {
      typeText(tR1, 'Artificial', 45, function () {
        setTimeout(function () { typeText(tR2, 'Intelligence', 45); }, 80);
      });
    }, 1000);

    /* 2.3s — fade out the top labels */
    setTimeout(function () {
      fade(tL1, 0, 500);
      fade(tR1, 0, 500);
    }, 2300);

    /* 2.5s — un-type the bottom labels back to a single "I" */
    setTimeout(function () {
      unTypeText(tL2, 35, 1);
      unTypeText(tR2, 35, 1);
    }, 2500);

    /* 3.0s — morph the "I" letters into the bars.
       Bars are placed at the text's bbox (scaled to text size), then
       animated to their natural size. The text "I" is hidden instantly
       at this exact moment so the only thing the eye sees is the bar
       growing from the I's position. */
    setTimeout(function () {
      var bxL = tL2.getBBox(), bxR = tR2.getBBox();
      var sxL = bxL.width  / BAR_W, syL = bxL.height / BAR_H;
      var sxR = bxR.width  / BAR_W, syR = bxR.height / BAR_H;
      var txL = (bxL.x + bxL.width  / 2) - BL_CX;
      var tyL = (bxL.y + bxL.height / 2) - BL_CY;
      var txR = (bxR.x + bxR.width  / 2) - BR_CX;
      var tyR = (bxR.y + bxR.height / 2) - BR_CY;

      bL.style.transform = 'translate(' + txL + 'px,' + tyL + 'px) scale(' + sxL + ',' + syL + ')';
      bR.style.transform = 'translate(' + txR + 'px,' + tyR + 'px) scale(' + sxR + ',' + syR + ')';

      // Hide the small "I" letters instantly — no transition. This is
      // the line whose absence caused them to linger in the previous
      // version.
      tL2.style.transition = 'none';
      tR2.style.transition = 'none';
      tL2.setAttribute('opacity', '0');
      tR2.setAttribute('opacity', '0');

      bL.setAttribute('opacity', '1');
      bR.setAttribute('opacity', '1');

      // Force a layout flush so the next frame's transform animation starts cleanly
      void logoAnim.offsetWidth;

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          bL.style.transition = 'transform 1000ms cubic-bezier(0.32,0.08,0.24,1)';
          bR.style.transition = 'transform 1000ms cubic-bezier(0.32,0.08,0.24,1)';
          bL.style.transform = 'none';
          bR.style.transform = 'none';
        });
      });
    }, 3000);

    /* 3.9s — draw the curves */
    setTimeout(function () { draw(c1, 1100); draw(c2, 1100); }, 3900);

    /* 5.1s — swap solid bars for gradient bars */
    setTimeout(function () {
      bL.style.transition = '';
      bR.style.transition = '';
      fade(bL, 0, 500);
      fade(bR, 0, 500);
      fade(gL, 1, 500);
      fade(gR, 1, 500);
    }, 5100);

    /* 5.4s — compact the logo (FLIP transform) and then, once it's
       largely settled, reveal the H1 and the hero subtitle/actions
       together as a single coordinated growth. This is the only
       "size change" the user sees besides the compact step. */
    setTimeout(function () {
      compactWithFLIP(2200);

      // Reveal H1 and hero-content together — one smooth grow.
      // Slight stagger (120ms) keeps the H1 leading the subtitle.
      setTimeout(function () {
        if (heroH1) heroH1.classList.add('visible');
      }, 1500);
      setTimeout(function () {
        if (heroContent) heroContent.classList.add('visible');
      }, 1620);
    }, 5400);
  }
})();
