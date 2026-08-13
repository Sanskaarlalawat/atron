/* ATCON — small progressive enhancements: mobile nav, scroll reveal,
   animated stat counters and a demo contact-form handler. */

(function () {
  "use strict";

  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
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
    var HEADER = 74;

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

  /* --- footer year --- */
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
