/* ATCON — small progressive enhancements: mobile nav, scroll reveal,
   animated stat counters and a demo contact-form handler. */

(function () {
  "use strict";

  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  /* The sticky header's height is declared once in CSS as --header-h and every
     sticky offset on the site is derived from it. Read it back here rather than
     repeating the number, or the scroll maths silently drifts out of register
     with the layout the next time the header is restyled. */
  function headerHeight() {
    var v = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--header-h")
    );
    return isNaN(v) ? 88 : v;
  }

  /* --- mobile navigation --- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "✕" : "☰";
    });

    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "☰";
      }
    });
  }

  /* --- header: firm up the glass once the page has moved ---
     Over the very top of the page the capsule sits on flat background and can
     stay light; as soon as content starts passing under it the tint and shadow
     step up so the nav keeps its contrast. Purely a finish change — the header
     never changes height, because everything else on the site pins to it. */
  var siteHeader = document.querySelector(".site-header");

  if (siteHeader) {
    var lastY = window.scrollY;

    var syncHeader = function () {
      var y = window.scrollY;
      siteHeader.classList.toggle("is-scrolled", y > 8);

      // Hide going down, reveal going up. The 6px deadband keeps trackpad
      // jitter from flickering it; it never hides in the first 220px (where
      // there is nothing to reclaim yet) and never while the mobile menu is
      // open, which would take the close button off-screen with it.
      var menuOpen = nav && nav.classList.contains("is-open");
      if (!menuOpen && Math.abs(y - lastY) > 6) {
        siteHeader.classList.toggle("is-hidden", y > lastY && y > 220);
      }
      lastY = y;
    };
    window.addEventListener("scroll", syncHeader, { passive: true });
    syncHeader();
  }

  /* --- reveal elements as they enter the viewport --- */
  var revealables = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    revealables.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px" });

    revealables.forEach(function (el) { revealObserver.observe(el); });
  }

  /* --- case stack: nudge each slide's content as it is covered ---
     The stacking itself is pure CSS (`position: sticky` on every slide at the
     same offset). This only adds depth: a slide's content lifts a little as the
     next slide rises over it, and the incoming slide's content settles up into
     place, so the swap reads as one card taking another's position rather than
     two flat layers crossing. */
  var slides = document.querySelectorAll("[data-slide]");

  if (slides.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var HEADER = headerHeight();

    var paintSlides = function () {
      var vh = window.innerHeight;

      slides.forEach(function (slide, i) {
        var inner = slide.querySelector("[data-slide-inner]");
        if (!inner) return;

        var rect = slide.getBoundingClientRect();
        var h = rect.height || 1;

        // 0 while the slide is still below the fold, 1 once it has pinned
        var entered = clamp01((vh - rect.top) / Math.max(vh - HEADER, 1));

        // how far the next slide has climbed over this one
        var covered = 0;
        var next = slides[i + 1];
        if (next) {
          var nextTop = next.getBoundingClientRect().top;
          covered = clamp01((h + HEADER - nextTop) / h);
        }

        // The device sits in the middle of its slide, so it only clears the
        // bottom of the viewport around halfway through the slide's travel.
        // Start the arrival there and finish it exactly as the slide pins —
        // map it any earlier and the first half plays off-screen and the rest
        // is over before the slide settles, which reads as no animation at all.
        var arrive = clamp01((entered - 0.45) / 0.55);
        slide.style.setProperty("--enter", (arrive * arrive * (3 - 2 * arrive)).toFixed(4));

        var lift = (1 - entered) * 46 - covered * 64;
        inner.style.transform =
          "translate3d(0," + lift.toFixed(1) + "px,0) scale(" +
          (1 - covered * 0.05).toFixed(4) + ")";
        // only the covered slide dims. Deliberately never keyed to `entered`:
        // that would leave every slide at opacity 0 until a scroll event lands,
        // so a throttled or missed listener would hide the section outright.
        inner.style.opacity = (1 - covered * 0.55).toFixed(3);
      });
    };

    var slidesQueued = false;
    var onSlidesScroll = function () {
      if (slidesQueued) return;
      slidesQueued = true;
      requestAnimationFrame(function () {
        slidesQueued = false;
        paintSlides();
      });
    };

    window.addEventListener("scroll", onSlidesScroll, { passive: true });
    window.addEventListener("resize", onSlidesScroll);
    // Browsers suspend rAF in a background tab, so a page scrolled or restored
    // while hidden keeps whatever --enter it was left with — which would show
    // the copy still faded out on return. Repaint as soon as we are visible.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) paintSlides();
    });
    paintSlides();
  }

  /* --- how we work: pinned 3D reveal ---
     .hww is a tall (340vh, set in CSS) scroll driver; .hww__pin sticks inside
     it for one header-clear viewport while the user scrolls through. This
     turns that scroll distance into a 0-1 progress value, same shape as
     paintSlides above: draw .hww-centerline top-down with it directly, and
     for each step work out where the line reaches that step's node (its y
     position on the 62-900 timeline, normalised to 0-1) and derive two
     narrower windows off that crossing — a quick, plain-smoothstep one for
     the node dot and its connector (--dot: the spark that lands on the line),
     and a slightly later, wider one for the card (--reveal). --reveal runs
     through an ease-out-back curve rather than smoothstep, so it overshoots
     past 1 before settling back — the card swings open past flat and eases
     back to rest instead of just scaling up, which is what makes the fold in
     how-we-work.css read as a hinge rather than a zoom. Both properties live
     on the step's group wrapper, so the CSS is what fans them out to the
     plate, connector, card and node — this loop only ever touches one
     element per step. */
  var hwwScene = document.querySelector("[data-hww-scene]");
  var hwwLine = document.querySelector("[data-hww-line]");
  var hwwGroups = document.querySelectorAll("[data-hww-step]");

  if (
    hwwScene && hwwLine && hwwGroups.length &&
    window.matchMedia("(min-width: 900px)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    var HWW_HEADER = headerHeight();
    // where each step's node sits on the centerline (y=62..900), normalised
    var HWW_THRESHOLDS = [0.2554, 0.4105, 0.6086, 0.7518];

    var smoothstep = function (edge0, edge1, x) {
      var t = clamp01((x - edge0) / (edge1 - edge0));
      return t * t * (3 - 2 * t);
    };

    // easeOutBack with a softened constant. The textbook 1.70158 overshoots
    // ~10%, which on a card this size reads as a visible bounce/wobble; 1.05
    // lands nearer 6% — enough that the fold settles rather than stops dead,
    // without the rubbery snap. f(0)=0 and f(1)=1 exactly for any c1.
    var easeOutBack = function (t) {
      var c1 = 1.05, c3 = c1 + 1;
      var x = clamp01(t);
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    };

    var paintHww = function () {
      var rect = hwwScene.getBoundingClientRect();
      var pinnedHeight = window.innerHeight - HWW_HEADER;
      var scrollable = rect.height - pinnedHeight;
      var progress = scrollable > 0 ? clamp01((HWW_HEADER - rect.top) / scrollable) : 0;

      hwwLine.style.transform = "scaleY(" + progress.toFixed(4) + ")";

      hwwGroups.forEach(function (group, i) {
        var t = HWW_THRESHOLDS[i];
        // start a touch before the line actually reaches the node, and run
        // long (0.24 vs the node gaps of ~0.15-0.20) so neighbouring cards
        // overlap slightly — the section then flows as one continuous move
        // instead of four separate pops with dead scroll between them.
        var start = t - 0.02;
        var span = 0.24;

        group.style.setProperty("--dot", smoothstep(t - 0.03, t + 0.05, progress).toFixed(4));
        group.style.setProperty("--reveal", easeOutBack((progress - start) / span).toFixed(4));
        // Opacity is deliberately NOT tied to --reveal. Fading and turning at
        // the same rate means the card is still half-transparent while it is
        // still edge-on, so the most 3D part of the move is the part you can
        // barely see. --fade finishes inside the first ~40% of the window: the
        // card goes solid early and then visibly turns.
        group.style.setProperty("--fade", smoothstep(start, start + span * 0.4, progress).toFixed(4));
      });
    };

    var hwwQueued = false;
    var onHwwScroll = function () {
      if (hwwQueued) return;
      hwwQueued = true;
      requestAnimationFrame(function () {
        hwwQueued = false;
        paintHww();
      });
    };

    // switches the section from its static, fully-visible default (safe for
    // no-JS) into the scrubbed state right before the first paint
    hwwScene.classList.add("is-scrubbable");

    window.addEventListener("scroll", onHwwScroll, { passive: true });
    window.addEventListener("resize", onHwwScroll);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) paintHww();
    });
    paintHww();
  }

  /* --- what we do: six cards on a scroll-driven helix ---
     The section pins and the scroll through it drives one value, p, from 0 to
     1. Each card owns a position on the helix given by

         t = i - p * (N - 1)

     so t is that card's signed distance from the focal point in card-widths:
     t = 0 is the card at the camera, positive t is still to arrive, negative t
     has already gone by. Advancing p by 1/(N-1) hands the focus to the next
     card, which is what makes the section step through them one at a time.

     From t the card's place in space follows directly:

         theta = t * STEP           the angle swept around the helix axis
         x     =  RX * sin(theta)   swings right as it approaches, left as it goes
         z     =  RZ * (cos(theta) - 1)   0 at the focus, receding either side
         y     = -t * RISE          climbs as it approaches, drops as it leaves

     which puts arriving cards small at the upper right, brings them face-on
     through the middle, and drops them away to the lower left. Note that the
     scale is NOT computed here: z plus the stage's perspective produce it, so
     a card genuinely recedes rather than merely being drawn smaller. */
  var wwdScene = document.querySelector("[data-wwd-scene]");
  var wwdCards = document.querySelectorAll("[data-wwd-card]");

  if (
    wwdScene && wwdCards.length &&
    window.matchMedia("(min-width: 900px)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    var WWD_HEADER = headerHeight();
    // RX and RISE are the two spacing knobs: RX spreads the cards sideways,
    // RISE spreads them vertically. Raise both together to open the run up
    // without changing the shape of the spiral.
    var WWD_STEP = 52;    // degrees of helix swept between neighbouring cards
    var WWD_RX = 390;     // px the path swings sideways
    var WWD_RZ = 620;     // px it recedes — large, or the helix reads as flat
    var WWD_RISE = 255;   // px of climb per card along the axis
    var WWD_LAST = wwdCards.length - 1;
    var DEG = Math.PI / 180;

    var wwdEase = function (x) {
      var t = clamp01(x);
      return t * t * (3 - 2 * t);
    };

    var paintWwd = function () {
      var rect = wwdScene.getBoundingClientRect();
      var vh = window.innerHeight;
      var scrollable = rect.height - (vh - WWD_HEADER);
      var p = scrollable > 0 ? clamp01((WWD_HEADER - rect.top) / scrollable) : 0;

      /* Arrival and departure.
         Without these the scene simply exists the instant the pin engages and
         blinks out the instant it lets go, which is the jarring part of any
         pinned section — the spiral is suddenly just *there*, fully formed.

         The pin is live while the section's top has reached the header AND its
         bottom is still below the fold, so those two edges give the two ramps:
           enter  — top travelling from one viewport away up to the header
           exit   — bottom rising past the fold once the pin has released
         The scene settles to rest exactly as the pin takes hold, and only
         starts leaving once it has let go, so the scrubbing itself is never
         touched by either ramp. */
      var enter = wwdEase((vh - rect.top) / Math.max(vh - WWD_HEADER, 1));
      var exit = wwdEase((vh - rect.bottom) / (vh * 0.55));

      wwdScene.style.setProperty("--stage-y", ((1 - enter) * 70 - exit * 55).toFixed(1) + "px");
      wwdScene.style.setProperty("--stage-s", ((0.93 + enter * 0.07) * (1 - exit * 0.08)).toFixed(4));
      wwdScene.style.setProperty("--stage-o", (enter * (1 - exit)).toFixed(3));

      wwdCards.forEach(function (card, i) {
        var t = i - p * WWD_LAST;
        var th = t * WWD_STEP * DEG;

        card.style.setProperty("--x", (WWD_RX * Math.sin(th)).toFixed(1) + "px");
        card.style.setProperty("--y", (-t * WWD_RISE).toFixed(1) + "px");
        card.style.setProperty("--z", (WWD_RZ * (Math.cos(th) - 1)).toFixed(1) + "px");
        // the card turns with the tangent of the path rather than staying
        // square to the camera, which is what stops it reading as a flat
        // carousel; the small x/z tilts keep it from feeling mechanical
        card.style.setProperty("--ry", (-t * WWD_STEP * 0.55).toFixed(2) + "deg");
        card.style.setProperty("--rx", (t * 3).toFixed(2) + "deg");
        card.style.setProperty("--rz", (-t * 2.5).toFixed(2) + "deg");
        var at = Math.abs(t);
        // fade the far ends of the run so cards enter and leave rather than
        // popping in at the edge of the stage — reaches 0 around |t| = 3, so
        // roughly six are on screen at once
        card.style.setProperty("--o", clamp01(1.25 - at * 0.4).toFixed(3));
        // Defocus with distance from the focal point. The dead band up to 0.4
        // keeps the card that is arriving at focus perfectly sharp for the
        // whole moment it is being read, so the blur never softens the one
        // card the user is actually looking at.
        card.style.setProperty("--blur", Math.min(12, Math.max(0, at - 0.4) * 6).toFixed(2) + "px");
      });
    };

    var wwdQueued = false;
    var onWwdScroll = function () {
      if (wwdQueued) return;
      wwdQueued = true;
      requestAnimationFrame(function () {
        wwdQueued = false;
        paintWwd();
      });
    };

    // same contract as the section above: the markup is a plain grid until JS
    // opts it into the spiral, so no-JS and reduced-motion keep every card
    wwdScene.classList.add("is-spiral");

    window.addEventListener("scroll", onWwdScroll, { passive: true });
    window.addEventListener("resize", onWwdScroll);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) paintWwd();
    });
    paintWwd();
  }

  /* --- testimonials: pick a profile, lift that card out of the row ---
     Each card owns a fixed slot (--k, set in the HTML and never rewritten), so
     the row keeps its shape and the chosen card rises straight up out of its own
     position rather than travelling to the front. The rise and the fall are both
     CSS transitions, which is what lets a switch read as a hand-off. */
  var tmList = document.querySelector("[data-tm-list]");
  var tmStack = document.querySelector("[data-tm-stack]");

  if (tmList && tmStack) {
    var tmItems = tmList.querySelectorAll("[data-tm]");
    var tmCards = tmStack.querySelectorAll("[data-tm-card]");

    // Split each quote into words so they can arrive one at a time. Done here
    // rather than in the markup so the HTML stays readable and the copy stays
    // editable as plain prose.
    tmItems.forEach(function (item) {
      var quote = item.querySelector(".tm-quote");
      if (!quote) return;
      // wrap it so the row itself can animate from 0fr to 1fr — a real height
      // animation, unlike max-height which eases a cap rather than the content
      var wrap = document.createElement("span");
      wrap.className = "tm-quote-wrap";
      quote.parentNode.insertBefore(wrap, quote);
      wrap.appendChild(quote);

      var words = quote.textContent.trim().split(/\s+/);
      quote.textContent = "";
      words.forEach(function (word, i) {
        var span = document.createElement("span");
        span.textContent = word;
        span.style.setProperty("--i", i);
        quote.appendChild(span);
        if (i < words.length - 1) quote.appendChild(document.createTextNode(" "));
      });
    });

    var selectTm = function (index) {
      tmItems.forEach(function (item, i) {
        var on = i === index;
        item.classList.toggle("is-on", on);
        item.setAttribute("aria-expanded", String(on));
      });

      tmCards.forEach(function (card, i) {
        var on = i === index;
        card.classList.toggle("is-on", on);
        // --k stays put: every card owns a slot in the row and the chosen one
        // lifts out of its own, rather than the stack reordering itself.
        // Only the lift needs to paint over its neighbours.
        card.style.zIndex = on ? String(tmCards.length + 1) : String(tmCards.length - i);

      });
    };

    tmItems.forEach(function (item) {
      item.addEventListener("click", function () {
        selectTm(parseInt(item.dataset.tm, 10));
      });
    });

    selectTm(0);
  }

  /* --- count up the impact numbers once they are on screen --- */
  var counters = document.querySelectorAll("[data-count]");

  function countUp(el) {
    var target = parseFloat(el.dataset.count);
    var suffix = el.dataset.suffix || "";
    var duration = 1100;
    var started = null;

    function frame(now) {
      if (started === null) started = now;
      var progress = Math.min((now - started) / duration, 1);
      // ease-out so the number settles instead of stopping dead
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  if (counters.length) {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      counters.forEach(function (el) {
        el.textContent = el.dataset.count + (el.dataset.suffix || "");
      });
    } else {
      var countObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          countUp(entry.target);
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.5 });

      counters.forEach(function (el) { countObserver.observe(el); });
    }
  }

  /* --- hero video: hold on the poster frame if motion is unwelcome --- */
  var heroVideo = document.querySelector("[data-hero-video]");

  if (heroVideo) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      heroVideo.removeAttribute("autoplay");
      heroVideo.pause();
    } else {
      // some browsers refuse the initial autoplay; retry once we're ready
      var play = heroVideo.play();
      if (play && typeof play.catch === "function") {
        play.catch(function () {
          heroVideo.addEventListener("canplay", function () {
            heroVideo.play().catch(function () {});
          }, { once: true });
        });
      }
    }
  }

  /* --- contact form: no backend yet, so acknowledge locally --- */
  var form = document.querySelector("[data-contact-form]");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector("[data-form-status]");
      if (status) {
        status.textContent =
          "Thanks — this demo form isn't wired to a backend yet. " +
          "Reach us at connect@atconglobal.com in the meantime.";
        status.style.color = "var(--blue)";
      }
      form.reset();
    });
  }

  /* --- client sequence: scroll-scrubbed frames ---
     Same pin-and-progress shape as the other scenes: the section is a tall
     runway, its child sticks for one viewport, and scroll distance becomes a
     0-1 value. Here that value picks a frame.

     Two things are deliberate. Frames are decoded up front and only then is
     the scrub armed — scrubbing straight away means every new frame decodes
     mid-scroll and the sequence stutters. And frames are drawn to a canvas
     rather than assigned to an <img> src, because a draw of an already-decoded
     bitmap is a copy, while an src swap re-enters the decode path. */
  var seqScene = document.querySelector("[data-seq]");
  var seqCanvas = document.querySelector("[data-seq-canvas]");

  if (seqScene && seqCanvas &&
      window.matchMedia("(min-width: 901px)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var seqCount = parseInt(seqScene.dataset.seqCount, 10) || 0;
    var seqPath = seqScene.dataset.seqPath || "";
    var seqPanels = seqScene.querySelectorAll("[data-seq-panel]");
    var ctx = seqCanvas.getContext("2d");
    var frames = [];
    var ready = 0;
    var shown = -1;

    var drawSeq = function () {
      var rect = seqScene.getBoundingClientRect();
      var header = headerHeight();
      var scrollable = rect.height - (window.innerHeight - header);
      var p = scrollable > 0 ? clamp01((header - rect.top) / scrollable) : 0;

      var i = Math.min(seqCount - 1, Math.round(p * (seqCount - 1)));
      if (i !== shown && frames[i] && frames[i].complete) {
        ctx.drawImage(frames[i], 0, 0, seqCanvas.width, seqCanvas.height);
        shown = i;
      }

      // first panel holds the opening third, second takes over past halfway
      seqPanels.forEach(function (panel, n) {
        var on = n === 0 ? 1 - clamp01((p - 0.34) / 0.12)
                         : clamp01((p - 0.46) / 0.12);
        panel.style.setProperty("--on", on.toFixed(3));
      });
    };

    var seqQueued = false;
    var onSeqScroll = function () {
      if (seqQueued) return;
      seqQueued = true;
      requestAnimationFrame(function () { seqQueued = false; drawSeq(); });
    };

    for (var i = 0; i < seqCount; i++) {
      var img = new Image();
      img.decoding = "async";
      img.onload = img.onerror = function () {
        if (++ready < seqCount) return;
        window.addEventListener("scroll", onSeqScroll, { passive: true });
        window.addEventListener("resize", onSeqScroll);
        drawSeq();
      };
      img.src = seqPath + String(i + 1).padStart(3, "0") + ".jpg";
      frames.push(img);
    }
  }

  /* --- the problem: wash to black, then orbit the copy ---
     Every card flies ONE continuous journey — there is no separate fly-in,
     orbit and fly-out. A card's whole life is a single angle sweeping 540
     degrees at a radius that starts enormous, collapses to the ring, and
     blows out again:

         angle  = 180 - 540 * t        180 = hard left, -360 = hard right
         radius = R * (1 + spiralIn + spiralOut)

     540 rather than 360 is what lets it enter on the left, carry a FULL turn
     around the copy, and still finish on the right. Because the radius is huge
     at t=0 and t=1, and the angle is 180 and -360 there, every card launches
     from the same far-left point and leaves through the same far-right one —
     while never stopping revolving. Entry and exit are the same spiral run in
     opposite directions, which is why they look alike.

     The stagger is tuned so consecutive cards sit a quarter turn apart
     (540 * STAG/DUR = 90), so "evenly spaced" falls out of the timing rather
     than being imposed. */
  var prb = document.querySelector("[data-prb]");
  var prbCards = document.querySelectorAll("[data-prb-card]");

  if (prb && prbCards.length &&
      window.matchMedia("(min-width: 901px)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    prb.classList.add("is-orbit");   // opt in to the animated state
    var RX = 430, RY = 235, D2R = Math.PI / 180;
    var STAG = 0.1033, DUR = 0.62, SPIRAL = 0.15, BLOW = 4.2;
    var ease = function (t) { var x = clamp01(t); return x * x * (3 - 2 * x); };

    var paintPrb = function () {
      var r = prb.getBoundingClientRect();
      // pin is full-viewport, so the runway is simply the overhang
      var scrollable = r.height - window.innerHeight;
      var p = scrollable > 0 ? clamp01(-r.top / scrollable) : 0;

      prb.style.setProperty("--dark", clamp01(p / 0.12).toFixed(3));
      // keyed to the third card reaching the ring, then drawn out over a long
      // stretch so the copy arrives slowly; *1.6 with offsets staggers the lines
      var tt = (p - 0.24) / 0.26;
      prb.style.setProperty("--t1", ease(tt * 1.6).toFixed(3));
      prb.style.setProperty("--t2", ease(tt * 1.6 - 0.3).toFixed(3));
      prb.style.setProperty("--t3", ease(tt * 1.6 - 0.6).toFixed(3));

      prbCards.forEach(function (card, i) {
        var t = (p - i * STAG) / DUR;
        if (t <= 0 || t >= 1) { card.style.setProperty("--o", "0"); return; }

        var ang = (180 - 540 * t) * D2R;

        // radius: enormous at both ends, R through the middle
        var sIn = 1 - clamp01(t / SPIRAL);
        var sOut = clamp01((t - (1 - SPIRAL)) / SPIRAL);
        var rad = 1 + (sIn * sIn + sOut * sOut) * BLOW;

        card.style.setProperty("--x", (Math.cos(ang) * RX * rad).toFixed(1) + "px");
        card.style.setProperty("--y", (Math.sin(ang) * RY * rad).toFixed(1) + "px");
        card.style.setProperty("--z", (Math.sin(ang) * 430).toFixed(1) + "px");
        // hard turn — at this angle perspective foreshortens the card across
        // its width, which is what makes it read as bent around the ring
        card.style.setProperty("--ry", (Math.cos(ang) * -64).toFixed(1) + "deg");
        card.style.setProperty("--rx", (Math.sin(ang) * 20).toFixed(1) + "deg");
        // small when far out on the spiral, full size on the ring
        card.style.setProperty("--s", (0.5 + 0.5 / rad + (Math.sin(ang) + 1) * 0.07).toFixed(3));
        card.style.setProperty("--o", Math.min(ease(t / 0.1), ease((1 - t) / 0.1)).toFixed(3));
      });
    };

    var prbQ = false;
    var onPrb = function () {
      if (prbQ) return;
      prbQ = true;
      requestAnimationFrame(function () { prbQ = false; paintPrb(); });
    };
    window.addEventListener("scroll", onPrb, { passive: true });
    window.addEventListener("resize", onPrb);
    paintPrb();
  }

  /* --- where we sit ---
     Three beats cut out of one progress value: the headline types itself, the A
     lifts out of the word and grows into the right of the frame, then the copy
     types in beside it. Characters are revealed with opacity rather than being
     inserted, so the line is fully laid out from the first frame — which is what
     lets the A's start position be measured once and trusted. */
  var wws = document.querySelector("[data-wws]");

  if (wws &&
      window.matchMedia("(min-width: 901px)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    wws.classList.add("is-typed");

    var wwsPin = wws.querySelector(".wws__pin");
    var wwsA = wws.querySelector("[data-wws-a]");
    var wwsSlot = wws.querySelector("[data-wws-aslot]");
    var ez = function (t) { var x = clamp01(t); return x * x * (3 - 2 * x); };

    // one cell per character, grouped into inline-block words; the A's slot is
    // pushed in as a cell of its own so it takes a turn in the typing order
    var cellsOf = function (root) {
      var out = [];
      [].slice.call(root.children).forEach(function (node) {
        if (node.hasAttribute("data-wws-aslot")) { out.push(node); return; }
        if (!node.hasAttribute("data-wws-seg")) return;
        var txt = node.textContent.replace(/\s+/g, " ");
        var frag = document.createDocumentFragment();
        var word = null;
        for (var i = 0; i < txt.length; i++) {
          var ch = txt.charAt(i);
          var cell = document.createElement("span");
          cell.className = "wws-cell";
          cell.textContent = ch === " " ? " " : ch;
          if (ch === " ") { word = null; frag.appendChild(cell); }
          else {
            if (!word) {
              word = document.createElement("span");
              word.className = "wws__w";
              frag.appendChild(word);
            }
            word.appendChild(cell);
          }
          out.push(cell);
        }
        node.textContent = "";
        node.appendChild(frag);
      });
      return out;
    };

    var wwsHead = cellsOf(wws.querySelector(".wws__line"));
    var wwsBody = cellsOf(wws.querySelector(".wws__body"));
    var wwsAIdx = wwsHead.indexOf(wwsSlot);

    // only the cells that changed since the last paint are touched
    var typeTo = function (cells, n) {
      if (cells._n === n) return;
      var lo = Math.min(cells._n || 0, n);
      var hi = Math.max(cells._n || 0, n);
      for (var i = lo; i < hi; i++) {
        if (cells[i]) cells[i].classList.toggle("is-on", i < n);
      }
      if (cells._caret) cells._caret.classList.remove("is-caret");
      cells._caret = (n > 0 && n < cells.length) ? cells[n - 1] : null;
      if (cells._caret) cells._caret.classList.add("is-caret");
      cells._n = n;
    };

    var A0 = null, A1 = null, S0 = 1;    var A0 = null, A1 = null, S0 = 1;    var A0 = null, A1 = null, S0 = 1;
    var AR = 71 / 68;   // the mark's own aspect

    var measureA = function () {
      var pin = wwsPin.getBoundingClientRect();
      var slot = wwsSlot.getBoundingClientRect();
      if (!slot.height || !pin.height) return;
      var big = pin.height * 0.70;
      // Lay the mark out at its FINAL size and scale DOWN for the inline state.
      // The browser rasterises a transformed layer once at its layout size, so
      // sizing it to the tiny inline slot and scaling up 14x stretches that
      // bitmap and the edges come out soft and stepped. This way the big state
      // — the one you actually look at — is drawn at 1:1.
      wwsA.style.width = (big * AR).toFixed(2) + "px";
      wwsA.style.height = big.toFixed(2) + "px";
      S0 = slot.height / big;
      A0 = { x: slot.left - pin.left, y: slot.top - pin.top };
      A1 = { x: pin.width - big * AR - pin.width * 0.05, y: (pin.height - big) / 2 };
    };

    var paintWws = function () {
      if (!A0) measureA();
      if (!A0) return;

      var r = wws.getBoundingClientRect();
      var scrollable = r.height - window.innerHeight;
      var p = scrollable > 0 ? clamp01(-r.top / scrollable) : 0;

      var n1 = Math.round(clamp01(p / 0.20) * wwsHead.length);
      typeTo(wwsHead, n1);
      wws.style.setProperty("--ao", n1 > wwsAIdx ? "1" : "0");

      // the A leaves the word; the rest of the line clears out ahead of it
      var t = ez((p - 0.26) / 0.22);
      wws.style.setProperty("--head", (1 - ez((p - 0.26) / 0.11)).toFixed(3));
      wws.style.setProperty("--ax", (A0.x + (A1.x - A0.x) * t).toFixed(1) + "px");
      wws.style.setProperty("--ay", (A0.y + (A1.y - A0.y) * t).toFixed(1) + "px");
      wws.style.setProperty("--as", (S0 + (1 - S0) * t).toFixed(4));

      typeTo(wwsBody, Math.round(clamp01((p - 0.50) / 0.42) * wwsBody.length));

    };

    var wwsQ = false;
    var onWws = function () {
      if (wwsQ) return;
      wwsQ = true;
      requestAnimationFrame(function () { wwsQ = false; paintWws(); });
    };
    window.addEventListener("scroll", onWws, { passive: true });
    window.addEventListener("resize", function () { A0 = null; onWws(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { A0 = null; paintWws(); });
    }
    paintWws();
  }

  /* --- section text reveal ---
     Headings are split into per-word spans and lifted in on a stagger; the copy
     under them follows as one block. Deliberately scoped away from the titles
     that already have their own motion (the typed WWS line, the scroll-washed
     problem and CTA headings, the pinned How We Work headline) — stacking two
     opacity animations on one element makes both look broken. */
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var txHeads = document.querySelectorAll(
      ".section-head .eyebrow, .section-head h2, .seq__title, .tm-title, .footer-head");
    // the supporting copy that sits with those headings
    var txBlocks = document.querySelectorAll(
      ".hero-copy .lead, .hero-copy .hero-actions, .tm-badge, .tm-list, .section-head p");

    // splits text nodes only, so <br> and any inline markup survive intact
    var splitWords = function (el) {
      var n = 0;
      (function walk(node) {
        [].slice.call(node.childNodes).forEach(function (child) {
          if (child.nodeType === 3) {
            if (!child.textContent.trim()) return;
            var frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) {
                frag.appendChild(document.createTextNode(part));
                return;
              }
              var w = document.createElement("span");
              w.className = "tx-w";
              w.style.setProperty("--i", Math.min(n++, 16));
              w.textContent = part;
              frag.appendChild(w);
            });
            node.replaceChild(frag, child);
          } else if (child.nodeType === 1 && child.tagName !== "BR") {
            walk(child);
          }
        });
      }(el));
      el.classList.add("tx", "is-split");
    };

    var txObs = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        obs.unobserve(e.target);
      });
    }, { threshold: 0.25, rootMargin: "0px 0px -50px" });

    txHeads.forEach(function (el) { splitWords(el); txObs.observe(el); });
    txBlocks.forEach(function (el) {
      el.classList.add("tx-b", "is-split");
      txObs.observe(el);
    });

    // the footer arrives as one cascade rather than all at once, so --i is set
    // per element in DOM order and the delay steps with it
    document.querySelectorAll(
      ".footer-eyebrow, .footer-btn, .footer-field, .footer-pair, .footer-nav," +
      " .footer-legal, .footer-mark"
    ).forEach(function (el, i) {
      el.classList.add("tx-b", "is-split");
      el.style.setProperty("--i", i);
      txObs.observe(el);
    });
  }

  /* --- CTA band: wash white out to black on approach --- */
  var ctaBand = document.querySelector("[data-cta-band]");

  if (ctaBand && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    ctaBand.classList.add("is-washed");
    var paintCta = function () {
      var r = ctaBand.getBoundingClientRect();
      var vh = window.innerHeight;
      // 0 as the band's top touches the fold, 1 once it has risen 55% of a screen
      ctaBand.style.setProperty("--dark", clamp01((vh - r.top) / (vh * 0.55)).toFixed(3));
    };
    var ctaQ = false;
    var onCta = function () {
      if (ctaQ) return;
      ctaQ = true;
      requestAnimationFrame(function () { ctaQ = false; paintCta(); });
    };
    window.addEventListener("scroll", onCta, { passive: true });
    window.addEventListener("resize", onCta);
    paintCta();
  }

  /* --- footer wordmark: liquid under the cursor ---
     The distortion is an SVG filter in the markup and runs at a fixed strength;
     what moves is the mask. A liquefied copy of the mark sits over the crisp
     one, revealed only inside a soft disc centred on the pointer, so the ripple
     reads as a local disturbance in the surface rather than the whole word
     wobbling. The pointer position is written straight to CSS custom properties
     — no layout is read or written per move, so this stays cheap. */
  var wet = document.querySelector(".footer-mark__wet");
  var wetHost = document.querySelector("[data-liquid]");

  if (wet && wetHost &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    wetHost.addEventListener("pointermove", function (e) {
      var r = wetHost.getBoundingClientRect();
      wet.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
      wet.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
      wet.style.setProperty("--wet", "1");
    });
    wetHost.addEventListener("pointerleave", function () {
      wet.style.setProperty("--wet", "0");
    });
  }

  /* --- footer year --- */
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
