/* ===========================================================
   IXRI Lab — Hero intro animation (rewritten)
   - transform/opacity-only animations (no layout-changing props)
   - getBBox called once, after fonts.ready, then cached
   - Mobile lite mode (~2.2s) and desktop full mode (~3.4s)
   - Honors prefers-reduced-motion (jumps to final state)
   - FLIP technique for the compact transition
   =========================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var svg = $('animSvg');
  if (!svg) return;

  var heroIntro = $('heroIntro');
  var logoAnim  = $('logoAnim');
  var bL = $('bL'), bR = $('bR'), gL = $('gL'), gR = $('gR');
  var c1 = $('c1'), c2 = $('c2');
  var tL1 = $('tL1'), tL2 = $('tL2');
  var tR1 = $('tR1'), tR2 = $('tR2');
  var heroContent = document.querySelector('.hero-content');

  var prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Treat narrow viewports OR coarse pointers as "mobile-ish"
  var isMobile =
    window.matchMedia &&
    window.matchMedia('(max-width: 734px), (pointer: coarse) and (max-width: 900px)').matches;

  // Phase scaling: tighter on mobile so the user reaches content faster
  var k = isMobile ? 0.7 : 1.0;
  var T = function (ms) { return Math.round(ms * k); };

  // Helpers
  var sleep = function (ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  };

  // Texts
  var L1_TEXT = 'Human', L2_TEXT = 'Intelligence';
  var R1_TEXT = 'Artificial', R2_TEXT = 'Intelligence';

  /* ---- Curve dash setup ---- */
  var len1 = c1.getTotalLength();
  var len2 = c2.getTotalLength();
  c1.style.strokeDasharray = len1; c1.style.strokeDashoffset = len1;
  c2.style.strokeDasharray = len2; c2.style.strokeDashoffset = len2;

  /* ---- Bar transform setup ---- */
  bL.style.transformBox = 'fill-box';
  bL.style.transformOrigin = 'center center';
  bR.style.transformBox = 'fill-box';
  bR.style.transformOrigin = 'center center';

  /* ---- Reduced-motion: jump to final state ---- */
  if (prefersReducedMotion) {
    [tL1, tL2, tR1, tR2].forEach(function (t) { t.setAttribute('opacity', '0'); });
    bL.setAttribute('opacity', '0');
    bR.setAttribute('opacity', '0');
    gL.setAttribute('opacity', '1');
    gR.setAttribute('opacity', '1');
    c1.setAttribute('opacity', '1'); c1.style.strokeDashoffset = '0';
    c2.setAttribute('opacity', '1'); c2.style.strokeDashoffset = '0';
    finishToFinalState(true);
    return;
  }

  /* ---- Helpers for animations ---- */
  function fadeTo(el, to, dur) {
    return el.animate(
      [{ opacity: getComputedStyle(el).opacity }, { opacity: to }],
      { duration: dur, easing: 'ease', fill: 'forwards' }
    ).finished.then(function () { el.setAttribute('opacity', String(to)); });
  }

  function drawCurve(el, dur) {
    el.setAttribute('opacity', '1');
    return el.animate(
      [{ strokeDashoffset: el.style.strokeDashoffset || el.getAttribute('stroke-dashoffset') || el.getTotalLength() },
       { strokeDashoffset: 0 }],
      { duration: dur, easing: 'cubic-bezier(0.32,0.08,0.24,1)', fill: 'forwards' }
    ).finished.then(function () { el.style.strokeDashoffset = '0'; });
  }

  // Type-in: animate opacity + small slide via transform; keeps text static (no per-char relayout)
  function showText(el, text, dur) {
    el.textContent = text;
    el.setAttribute('opacity', '1');
    // Use a wrapping group transform via CSS variable on the element itself.
    // For SVG <text>, transform attribute is supported.
    var anim = el.animate(
      [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      { duration: dur, easing: 'cubic-bezier(0.32,0.08,0.24,1)', fill: 'forwards' }
    );
    return anim.finished;
  }

  function hideText(el, dur) {
    return el.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: dur, easing: 'ease', fill: 'forwards' }
    ).finished.then(function () { el.setAttribute('opacity', '0'); });
  }

  // Shrink "Intelligence" to just "I" via opacity crossfade — avoids per-char relayout cost.
  function shrinkToI(el, dur) {
    // Replace text content first, then fade in the new "I" while old fades out.
    // To do a clean visual reduction, we just swap textContent and apply a brief scale animation.
    var fadeOut = el.animate(
      [{ opacity: 1 }, { opacity: 0.35 }],
      { duration: dur * 0.4, easing: 'ease', fill: 'forwards' }
    );
    return fadeOut.finished.then(function () {
      el.textContent = 'I';
      return el.animate(
        [{ opacity: 0.35 }, { opacity: 1 }],
        { duration: dur * 0.6, easing: 'ease', fill: 'forwards' }
      ).finished;
    });
  }

  /* ---- Compute morph (text "I" → bar) once after fonts ---- */
  function computeMorph() {
    var BAR_W = 49, BAR_H = 365;
    var BL_CX = 89  + BAR_W / 2, BL_CY = 117 + BAR_H / 2;
    var BR_CX = 442 + BAR_W / 2, BR_CY = 117 + BAR_H / 2;
    var bxL = tL2.getBBox(), bxR = tR2.getBBox();
    return {
      L: {
        sx: bxL.width / BAR_W,
        sy: bxL.height / BAR_H,
        tx: (bxL.x + bxL.width / 2) - BL_CX,
        ty: (bxL.y + bxL.height / 2) - BL_CY,
      },
      R: {
        sx: bxR.width / BAR_W,
        sy: bxR.height / BAR_H,
        tx: (bxR.x + bxR.width / 2) - BR_CX,
        ty: (bxR.y + bxR.height / 2) - BR_CY,
      }
    };
  }

  function morphTextToBar(dur, morph) {
    // Place bars at text "I" position scaled to text size; show them; hide texts.
    bL.style.transform = 'translate(' + morph.L.tx + 'px,' + morph.L.ty + 'px) scale(' + morph.L.sx + ',' + morph.L.sy + ')';
    bR.style.transform = 'translate(' + morph.R.tx + 'px,' + morph.R.ty + 'px) scale(' + morph.R.sx + ',' + morph.R.sy + ')';
    bL.setAttribute('opacity', '1');
    bR.setAttribute('opacity', '1');
    tL2.setAttribute('opacity', '0');
    tR2.setAttribute('opacity', '0');

    // Animate to identity
    var animL = bL.animate(
      [
        { transform: bL.style.transform },
        { transform: 'translate(0,0) scale(1,1)' }
      ],
      { duration: dur, easing: 'cubic-bezier(0.32,0.08,0.24,1)', fill: 'forwards' }
    );
    var animR = bR.animate(
      [
        { transform: bR.style.transform },
        { transform: 'translate(0,0) scale(1,1)' }
      ],
      { duration: dur, easing: 'cubic-bezier(0.32,0.08,0.24,1)', fill: 'forwards' }
    );
    return Promise.all([animL.finished, animR.finished]).then(function () {
      bL.style.transform = '';
      bR.style.transform = '';
    });
  }

  /* ---- FLIP for the compact transition ----
     The container becomes "compact" (smaller layout slot) and we visually
     animate from previous size/position to new with transform only. */
  function compactWithFLIP(dur) {
    var first = logoAnim.getBoundingClientRect();
    logoAnim.classList.add('compact');
    var last = logoAnim.getBoundingClientRect();

    var dx = first.left - last.left;
    var dy = first.top - last.top;
    var sx = first.width / Math.max(last.width, 1);
    var sy = first.height / Math.max(last.height, 1);

    logoAnim.style.transformOrigin = 'top left';
    logoAnim.style.transform =
      'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')';
    logoAnim.style.willChange = 'transform';

    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var anim = logoAnim.animate(
            [
              { transform: logoAnim.style.transform },
              { transform: 'translate(0,0) scale(1,1)' }
            ],
            { duration: dur, easing: 'cubic-bezier(0.32,0.08,0.24,1)', fill: 'forwards' }
          );
          anim.finished.then(function () {
            logoAnim.style.transform = '';
            logoAnim.style.willChange = '';
            resolve();
          });
        });
      });
    });
  }

  /* ---- H1 reveal — opacity + tiny slide, no layout transition ---- */
  function revealH1(dur) {
    var h1 = document.createElement('h1');
    h1.id = 'heroH1';
    h1.innerHTML = 'Connecting Intelligences<br>beyond Boundaries';
    heroIntro.appendChild(h1);
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          h1.classList.add('visible');
          setTimeout(resolve, dur);
        });
      });
    });
  }

  function revealHeroContent() {
    if (heroContent) heroContent.classList.add('visible');
  }

  function finishToFinalState(skipReveal) {
    logoAnim.classList.add('compact');
    var h1 = $('heroH1');
    if (!h1) {
      h1 = document.createElement('h1');
      h1.id = 'heroH1';
      h1.innerHTML = 'Connecting Intelligences<br>beyond Boundaries';
      heroIntro.appendChild(h1);
    }
    h1.classList.add('visible');
    if (heroContent) heroContent.classList.add('visible');
  }

  /* ---- Run! ---- */
  // Wait for fonts so getBBox is correct.
  var fontsReady = (document.fonts && document.fonts.ready)
    ? document.fonts.ready
    : Promise.resolve();

  fontsReady.then(function () {
    return runSequence();
  }).catch(function () {
    // On any error, fall through to final state to never block content.
    finishToFinalState(true);
  });

  function runSequence() {
    if (isMobile) return runMobile();
    return runDesktop();
  }

  /* ---- Desktop sequence (~3.4s) ---- */
  function runDesktop() {
    var morph;
    return Promise.resolve()
      // Phase 1: show two-line labels (left first, right slightly delayed)
      .then(function () {
        showText(tL1, L1_TEXT, T(360));
        return sleep(T(120)).then(function () {
          return Promise.all([
            showText(tL2, L2_TEXT, T(360)),
            showText(tR1, R1_TEXT, T(360)),
          ]);
        });
      })
      .then(function () { return showText(tR2, R2_TEXT, T(360)); })
      .then(function () { return sleep(T(260)); })
      // Phase 2: fade out top labels, shrink bottom labels to "I"
      .then(function () {
        return Promise.all([
          hideText(tL1, T(280)),
          hideText(tR1, T(280)),
          shrinkToI(tL2, T(360)),
          shrinkToI(tR2, T(360)),
        ]);
      })
      // Phase 3: morph text "I" → bars
      .then(function () {
        morph = computeMorph();
        return morphTextToBar(T(620), morph);
      })
      // Phase 4: draw curves
      .then(function () {
        return Promise.all([drawCurve(c1, T(720)), drawCurve(c2, T(720))]);
      })
      // Phase 5: gradient swap on bars
      .then(function () {
        return Promise.all([
          fadeTo(bL, 0, T(280)),
          fadeTo(bR, 0, T(280)),
          fadeTo(gL, 1, T(280)),
          fadeTo(gR, 1, T(280)),
        ]);
      })
      .then(function () { return sleep(T(80)); })
      // Phase 6: compact + reveal H1, then hero content
      .then(function () {
        var compactPromise = compactWithFLIP(T(720));
        // Reveal H1 in parallel, slightly after compact begins
        var h1Promise = sleep(T(200)).then(function () { return revealH1(T(700)); });
        return Promise.all([compactPromise, h1Promise]);
      })
      .then(function () {
        revealHeroContent();
      });
  }

  /* ---- Mobile sequence (~2.2s) — simpler, more direct ---- */
  function runMobile() {
    var morph;
    return Promise.resolve()
      // Show all 4 labels with a quick stagger
      .then(function () {
        showText(tL1, L1_TEXT, T(280));
        showText(tR1, R1_TEXT, T(280));
        return sleep(T(80));
      })
      .then(function () {
        return Promise.all([
          showText(tL2, L2_TEXT, T(280)),
          showText(tR2, R2_TEXT, T(280)),
        ]);
      })
      .then(function () { return sleep(T(180)); })
      // Fade out top, shrink bottom
      .then(function () {
        return Promise.all([
          hideText(tL1, T(200)),
          hideText(tR1, T(200)),
          shrinkToI(tL2, T(260)),
          shrinkToI(tR2, T(260)),
        ]);
      })
      // Morph + draw + gradient swap (overlapped to feel snappy)
      .then(function () {
        morph = computeMorph();
        return morphTextToBar(T(440), morph);
      })
      .then(function () {
        // draw curves and gradient swap in parallel
        return Promise.all([
          drawCurve(c1, T(560)),
          drawCurve(c2, T(560)),
          sleep(T(280)).then(function () {
            return Promise.all([
              fadeTo(bL, 0, T(220)),
              fadeTo(bR, 0, T(220)),
              fadeTo(gL, 1, T(220)),
              fadeTo(gR, 1, T(220)),
            ]);
          }),
        ]);
      })
      // Compact + reveal
      .then(function () {
        var compactPromise = compactWithFLIP(T(520));
        var h1Promise = sleep(T(140)).then(function () { return revealH1(T(520)); });
        return Promise.all([compactPromise, h1Promise]);
      })
      .then(function () {
        revealHeroContent();
      });
  }
})();
