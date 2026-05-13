/* ─────────────────────────────────────────────────────────────────
   AI Transformation Programme — Deck interactions
   ───────────────────────────────────────────────────────────────── */

(() => {
  // Debug flag: ?noanim=1 disables all reveal animations (used for screenshots)
  if (/[?&]noanim=1\b/.test(location.search)) {
    document.body.setAttribute("data-no-anim", "");
  }

  const deck = document.getElementById("deck");
  const slides = Array.from(document.querySelectorAll(".slide"));
  const slideNumEl = document.getElementById("slide-num");
  const slideTotalEl = document.getElementById("slide-total");
  const progressFill = document.getElementById("progress-fill");
  const sectionBtns = Array.from(document.querySelectorAll(".section-btn"));

  const total = slides.length;
  let current = 0;

  slideTotalEl.textContent = String(total).padStart(2, "0");

  /* ───── Viewport scaling ─────────────────────────────────────── */
  const CANVAS_BREAKPOINT = 1024;

  function fitDeck() {
    if (window.innerWidth < CANVAS_BREAKPOINT) {
      deck.style.transform = "none";
      return;
    }
    const W = 1440, H = 810;
    const padding = 48;
    const scale = Math.min(
      (window.innerWidth - padding) / W,
      (window.innerHeight - padding) / H,
      1
    );
    deck.style.transform = `scale(${scale})`;
  }
  window.addEventListener("resize", fitDeck);
  fitDeck();

  /* ───── Touch / swipe navigation ────────────────────────────── */
  let touchStartX = 0;
  let touchStartY = 0;

  deck.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  deck.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    // Require a clear horizontal swipe (> 48 px) with minimal vertical drift
    if (Math.abs(dx) > 48 && dy < 80) {
      if (dx < 0) go(current + 1);
      else go(current - 1);
    }
  }, { passive: true });

  /* ───── Core navigation ──────────────────────────────────────── */
  function go(i, opts = {}) {
    const clamped = Math.max(0, Math.min(total - 1, i));
    if (clamped === current && !opts.force) return;

    slides[current].classList.remove("is-active");
    slides[clamped].classList.add("is-active");
    current = clamped;
    onSlideEnter(slides[current]);
    updateChrome();

    // On fluid mobile layout, reset scroll so each slide starts at top
    if (window.innerWidth < CANVAS_BREAKPOINT) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    if (!opts.skipHash) {
      const num = current + 1;
      history.replaceState(null, "", `#${num}`);
    }
  }

  function updateChrome() {
    slideNumEl.textContent = String(current + 1).padStart(2, "0");
    const p = (current + 1) / total;
    progressFill.style.setProperty("--p", p);
    const section = slides[current].dataset.section;
    sectionBtns.forEach((b) => {
      b.classList.toggle("is-active", b.dataset.section === section);
    });
  }

  /* ───── Per-slide enter hooks ────────────────────────────────── */
  function onSlideEnter(slide) {
    // Reset tab indicators inside this slide to match active tab
    slide.querySelectorAll("[data-tabs]").forEach(positionTabIndicator);
    // Reset segmented thumb
    slide.querySelectorAll(".segmented").forEach(positionSegmentedThumb);
    // Reset timeline progress bar on slide enter
    const timeline = slide.querySelector("[data-timeline]");
    if (timeline) setTimelineProgress(timeline, "0%");
    // Reset triangle hover state + panel text
    const t = slide.querySelector("[data-triangle]");
    if (t && t._reset) t._reset();
    // Reset LP hover state
    const lp = slide.querySelector("[data-lp]");
    if (lp) {
      lp.classList.remove("is-leg-group", "is-leg-bootcamp", "is-leg-pods");
    }
  }

  /* ───── Keyboard ─────────────────────────────────────────────── */
  window.addEventListener("keydown", (e) => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.isContentEditable)) return;

    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
      e.preventDefault();
      go(current + 1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      go(current - 1);
    } else if (e.key === "Home") {
      e.preventDefault(); go(0);
    } else if (e.key === "End") {
      e.preventDefault(); go(total - 1);
    } else if (/^[1-9]$/.test(e.key)) {
      const n = parseInt(e.key, 10) - 1;
      if (n < total) go(n);
    }
  });

  /* ───── Click controls ───────────────────────────────────────── */
  document.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      if (action === "next") go(current + 1);
      else if (action === "prev") go(current - 1);
    });
  });

  sectionBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const jump = parseInt(btn.dataset.jump, 10);
      if (!Number.isNaN(jump)) go(jump - 1);
    });
  });

  /* ───── Hash sync on load ────────────────────────────────────── */
  function readHash(initial = false) {
    const m = location.hash.match(/^#(\d+)$/);
    const targetIdx = m ? Math.max(0, Math.min(total - 1, parseInt(m[1], 10) - 1)) : 0;

    if (initial) {
      current = targetIdx;
      updateChrome();
      // Defer activation two frames so the reveal elements' initial styles commit first,
      // then transition when .is-active is added on the parent.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (current === targetIdx && !slides[targetIdx].classList.contains("is-active")) {
            slides[targetIdx].classList.add("is-active");
            onSlideEnter(slides[targetIdx]);
          }
        });
      });
    } else if (m) {
      go(targetIdx, { skipHash: true });
    }
  }
  window.addEventListener("hashchange", () => readHash(false));
  readHash(true);

  /* ───── Tabs component (slides 5-7) ──────────────────────────── */
  function positionTabIndicator(container) {
    const activeTab = container.querySelector(".tab.is-active");
    const indicator = container.querySelector(".tabs__indicator");
    if (!activeTab || !indicator) return;
    // offsetLeft/Width are in unscaled layout coords (immune to the deck's CSS transform)
    indicator.style.setProperty("--ix", `${activeTab.offsetLeft}px`);
    indicator.style.setProperty("--iw", `${activeTab.offsetWidth}px`);
  }

  document.querySelectorAll("[data-tabs]").forEach((container) => {
    const tabs = container.querySelectorAll(".tab");
    const panels = container.querySelectorAll(".tab-panel");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("is-active"));
        panels.forEach((p) => p.classList.remove("is-active"));
        tab.classList.add("is-active");
        const target = tab.dataset.tab;
        container.querySelector(`[data-panel="${target}"]`)?.classList.add("is-active");
        positionTabIndicator(container);
      });
    });
  });

  // Initialise tab indicators after a tick (fonts/layout settle)
  requestAnimationFrame(() => {
    document.querySelectorAll("[data-tabs]").forEach(positionTabIndicator);
  });
  window.addEventListener("load", () => {
    document.querySelectorAll("[data-tabs]").forEach(positionTabIndicator);
  });


  /* ───── Triangle (slide 8) ───────────────────────────────────── */
  const triangle = document.querySelector("[data-triangle]");
  if (triangle) {
    const panel = {
      kicker: document.getElementById("tp-kicker"),
      title: document.getElementById("tp-title"),
      body: document.getElementById("tp-body"),
    };

    const nodeContent = {
      group: {
        kicker: "Leg 01 · Enablement Group",
        title: "Clarifies what good looks like.",
        body:
          "The Group compares what's already happening and reduces drift early — giving the other two legs a coherent target to move toward.",
      },
      bootcamp: {
        kicker: "Leg 02 · Bootcamp",
        title: "Creates movement and a common baseline.",
        body:
          "Bootcamp moves the wider CEED UX group in a practical way and helps surface the smaller advanced bench ready for deeper work.",
      },
      pods: {
        kicker: "Leg 03 · Applied Pods",
        title: "Proves the model in real work.",
        body:
          "Pods work close to real problems with real constraints, producing a working validated version and examples others can learn from.",
      },
    };

    const edgeContent = {
      "group-bootcamp": {
        kicker: "Edge · 01 → 02",
        title: "Group → Bootcamp",
        body:
          "Surfaces what the baseline should include and where the gaps are.",
      },
      "group-pods": {
        kicker: "Edge · 03 → 01",
        title: "Pods → Group",
        body:
          "Creates real examples, real blockers and real lessons that sharpen what good looks like.",
      },
      "bootcamp-pods": {
        kicker: "Edge · 02 → 03",
        title: "Bootcamp → Pods",
        body:
          "Helps identify who is ready to go deeper and where capability needs strengthening before pods start.",
      },
    };

    const defaultState = {
      kicker: "Hover any node or edge",
      title: "A short learning loop.",
      body:
        "Alignment, capability and application feeding each other — so the programme compounds instead of running as three separate tracks.",
    };

    function setPanel(content) {
      panel.kicker.textContent = content.kicker;
      panel.title.textContent = content.title;
      panel.body.textContent = content.body;
    }

    function clearState() {
      triangle.classList.remove(
        "is-node-group", "is-node-bootcamp", "is-node-pods",
        "is-edge-group-bootcamp", "is-edge-group-pods", "is-edge-bootcamp-pods"
      );
    }

    // expose a reset so slide-enter can restore default text + classes
    triangle._reset = () => { clearState(); setPanel(defaultState); };

    triangle.querySelectorAll(".node").forEach((node) => {
      const key = node.dataset.node;
      node.addEventListener("mouseenter", () => {
        clearState();
        triangle.classList.add(`is-node-${key}`);
        setPanel(nodeContent[key]);
      });
      node.addEventListener("mouseleave", () => {
        clearState();
        setPanel(defaultState);
      });
    });

    triangle.querySelectorAll(".edge-hit").forEach((edge) => {
      const key = edge.dataset.edge;
      edge.addEventListener("mouseenter", () => {
        clearState();
        triangle.classList.add(`is-edge-${key}`);
        setPanel(edgeContent[key]);
      });
      edge.addEventListener("mouseleave", () => {
        clearState();
        setPanel(defaultState);
      });
    });
  }

  /* ───── LearningPath (slide 9) ───────────────────────────────── */
  const lp = document.querySelector("[data-lp]");
  if (lp) {
    const boxes = lp.querySelectorAll(".lp-box");
    boxes.forEach((box) => {
      const leg = box.dataset.lpLeg;
      box.addEventListener("mouseenter", () => {
        lp.classList.remove("is-leg-group", "is-leg-bootcamp", "is-leg-pods");
        lp.classList.add(`is-leg-${leg}`);
      });
      box.addEventListener("mouseleave", () => {
        lp.classList.remove("is-leg-group", "is-leg-bootcamp", "is-leg-pods");
      });
    });
  }

  /* ───── Timeline phases (slide 10) ───────────────────────────── */
  function setTimelineProgress(timeline, pct) {
    const prog = timeline.querySelector(".timeline__progress");
    if (prog) prog.style.setProperty("--tp", pct || "0%");
  }

  document.querySelectorAll("[data-timeline]").forEach((timeline) => {
    const phases = timeline.querySelectorAll(".phase");
    const pcts = ["33%", "66%", "100%"];
    phases.forEach((p, idx) => {
      p.addEventListener("mouseenter", () => setTimelineProgress(timeline, pcts[idx]));
      p.addEventListener("mouseleave", () => setTimelineProgress(timeline, "0%"));
    });
  });

  /* ───── Segmented control (slide 11) ─────────────────────────── */
  function positionSegmentedThumb(group) {
    const active = group.querySelector(".seg.is-active");
    const thumb = group.querySelector(".segmented__thumb");
    if (!active || !thumb) return;
    thumb.style.setProperty("--sx", `${active.offsetLeft}px`);
    thumb.style.setProperty("--sw", `${active.offsetWidth}px`);
  }

  document.querySelectorAll("[data-success]").forEach((container) => {
    const segs = container.querySelectorAll(".seg");
    const panels = container.querySelectorAll(".success__panel");
    const group = container.querySelector(".segmented");
    segs.forEach((seg) => {
      seg.addEventListener("click", () => {
        segs.forEach((s) => s.classList.remove("is-active"));
        panels.forEach((p) => p.classList.remove("is-active"));
        seg.classList.add("is-active");
        container.querySelector(`[data-panel="${seg.dataset.seg}"]`)?.classList.add("is-active");
        positionSegmentedThumb(group);
      });
    });
  });

  window.addEventListener("load", () => {
    document.querySelectorAll(".segmented").forEach(positionSegmentedThumb);
  });
  requestAnimationFrame(() => {
    document.querySelectorAll(".segmented").forEach(positionSegmentedThumb);
  });

  /* ───── Accordion (slide 13) ─────────────────────────────────── */
  document.querySelectorAll("[data-accordion] .acc").forEach((acc) => {
    acc.addEventListener("click", () => {
      const isOpen = acc.getAttribute("aria-expanded") === "true";
      acc.setAttribute("aria-expanded", String(!isOpen));
    });
  });

  /* ───── Re-measure indicators on resize ──────────────────────── */
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      document.querySelectorAll("[data-tabs]").forEach(positionTabIndicator);
      document.querySelectorAll(".segmented").forEach(positionSegmentedThumb);
    }, 120);
  });
})();

/* ─────────────────────────────────────────────────────────────────
   Deep Dive Drawer (slide 6 — Bootcamp)
   ───────────────────────────────────────────────────────────────── */
(() => {
  const drawer = document.querySelector("[data-deep-dive]");
  const backdrop = document.querySelector("[data-deep-dive-backdrop]");
  const triggers = document.querySelectorAll("[data-deep-dive-open]");
  const closers = document.querySelectorAll("[data-deep-dive-close]");
  const slide6 = document.querySelector('[data-slide="6"]');

  if (!drawer || !backdrop) return;

  function open() {
    drawer.classList.add("is-open");
    backdrop.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    backdrop.setAttribute("aria-hidden", "false");
    // Reset scroll to top each time we open
    const body = drawer.querySelector(".dd__body");
    if (body) body.scrollTop = 0;
  }

  function close() {
    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.setAttribute("aria-hidden", "true");
  }

  function isOpen() {
    return drawer.classList.contains("is-open");
  }

  triggers.forEach((t) => t.addEventListener("click", open));
  closers.forEach((c) => c.addEventListener("click", close));
  backdrop.addEventListener("click", close);

  // Intercept keys while open — ESC closes; arrows/space don't navigate slides
  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    const blocked = ["ArrowLeft", "ArrowRight", "PageUp", "PageDown", " ", "Home", "End"];
    if (blocked.includes(e.key) || /^[1-9]$/.test(e.key)) {
      e.stopPropagation();
    }
  }, true);

  // Close drawer automatically when slide 6 is no longer active
  if (slide6) {
    const slideObserver = new MutationObserver(() => {
      if (!slide6.classList.contains("is-active") && isOpen()) close();
    });
    slideObserver.observe(slide6, { attributes: true, attributeFilter: ["class"] });
  }
})();
