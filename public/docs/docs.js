(function () {
  "use strict";

  var THEME_KEY = "bitbabit-docs-theme";

  function getPreferredTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    var btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.setAttribute("aria-label", theme === "dark" ? "Light mode" : "Dark mode");
      btn.setAttribute("title", theme === "dark" ? "Light mode" : "Dark mode");
    }
  }

  function initTheme() {
    applyTheme(getPreferredTheme());
    var btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.addEventListener("click", function () {
        var next =
          document.documentElement.getAttribute("data-theme") === "dark"
            ? "light"
            : "dark";
        applyTheme(next);
      });
    }
  }

  function initSidebar() {
    var sidebar = document.getElementById("doc-sidebar");
    var toggle = document.getElementById("nav-toggle");
    var backdrop = document.getElementById("sidebar-backdrop");
    function close() {
      sidebar.classList.remove("is-open");
      backdrop.classList.remove("is-visible");
    }
    function open() {
      sidebar.classList.add("is-open");
      backdrop.classList.add("is-visible");
    }
    if (toggle && sidebar && backdrop) {
      toggle.addEventListener("click", function () {
        if (sidebar.classList.contains("is-open")) close();
        else open();
      });
      backdrop.addEventListener("click", close);
    }
    document.querySelectorAll('.doc-nav a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function () {
        if (window.innerWidth <= 900) close();
      });
    });
  }

  function initScrollSpy() {
    var links = document.querySelectorAll('.doc-nav a[href^="#"]');
    var sections = [];
    links.forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      if (el) sections.push({ id: id, el: el, link: a });
    });
    if (!sections.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = entry.target.id;
          links.forEach(function (a) {
            a.classList.toggle("is-active", a.getAttribute("href") === "#" + id);
          });
        });
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );
    sections.forEach(function (s) {
      observer.observe(s.el);
    });
  }

  function initCopyButtons() {
    document.querySelectorAll(".code-block-wrap").forEach(function (wrap) {
      var pre = wrap.querySelector("pre");
      if (!pre) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      btn.addEventListener("click", function () {
        var text = pre.textContent || "";
        navigator.clipboard.writeText(text).then(
          function () {
            btn.textContent = "Copied";
            btn.classList.add("is-copied");
            setTimeout(function () {
              btn.textContent = "Copy";
              btn.classList.remove("is-copied");
            }, 2000);
          },
          function () {
            btn.textContent = "Failed";
            setTimeout(function () {
              btn.textContent = "Copy";
            }, 2000);
          },
        );
      });
      wrap.appendChild(btn);
    });
  }

  function initTabs() {
    document.querySelectorAll("[data-tabs]").forEach(function (root) {
      var buttons = root.querySelectorAll(".tabs__btn");
      var panels = root.querySelectorAll(".tabs__panel");
      buttons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("aria-controls");
          buttons.forEach(function (b) {
            b.setAttribute("aria-selected", b === btn ? "true" : "false");
          });
          panels.forEach(function (p) {
            p.classList.toggle("is-visible", p.id === id);
          });
        });
      });
    });
  }

  function initAccordion() {
    document.querySelectorAll(".accordion__trigger").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".accordion__item");
        var wasOpen = item.classList.contains("is-open");
        item.parentElement.querySelectorAll(".accordion__item").forEach(function (i) {
          i.classList.remove("is-open");
          var t = i.querySelector(".accordion__trigger");
          if (t) t.setAttribute("aria-expanded", "false");
        });
        if (!wasOpen) {
          item.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    initTheme();
    initSidebar();
    initScrollSpy();
    initCopyButtons();
    initTabs();
    initAccordion();
  }
})();
