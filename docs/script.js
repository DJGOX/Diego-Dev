(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // Year
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile menu
  const burger = $("#burger");
  const mobileMenu = $("#mobileMenu");
  if (burger && mobileMenu) {
    burger.addEventListener("click", () => {
      const isOpen = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", String(!isOpen));
      mobileMenu.hidden = isOpen;
    });

    $$("#mobileMenu a").forEach(a => {
      a.addEventListener("click", () => {
        burger.setAttribute("aria-expanded", "false");
        mobileMenu.hidden = true;
      });
    });
  }

  // Smooth scroll reveal
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealEls = $$(".reveal");

  if (!reducedMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("on");
          io.unobserve(e.target);
        }
      });
    }, { root: null, threshold: 0.12, rootMargin: "0px 0px -10% 0px" });

    revealEls.forEach(el => {
      // Start hidden; remove any hard-coded "on"
      el.classList.remove("on");
      io.observe(el);
    });
  } else {
    // Fallback
    revealEls.forEach(el => el.classList.add("on"));
  }

  // Theme toggle (light/dark)
  const html = document.documentElement;
  const toggle = $("#themeToggle");
  const icon = $("#themeIcon");

  const ICONS = {
    moon: `<path d="M21 12.8A8.5 8.5 0 0 1 11.2 3a7 7 0 1 0 9.8 9.8Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
    sun: `
      <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" stroke-width="2"/>
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    `
  };

  function setTheme(theme) {
    html.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    if (icon) icon.innerHTML = theme === "dark" ? ICONS.sun : ICONS.moon;
  }

  // Initial theme: saved > system preference
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") {
    setTheme(saved);
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }

  if (toggle) {
    toggle.addEventListener("click", () => {
      const current = html.getAttribute("data-theme") || "light";
      setTheme(current === "dark" ? "light" : "dark");
    });
  }
})();
