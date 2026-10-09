// In-page age gate for static pages. Same localStorage key as AgeGate.dc.html.
// This file stays on the site origin. It does not load a third party script.
(function () {
  var KEY = "bond_age_ok";
  var MAX = 30 * 24 * 60 * 60 * 1000;

  function readStore(store) {
    try { return store.getItem(KEY); } catch (e) { return null; }
  }

  function freshTime(raw, now) {
    if (raw == null || raw === "") return null;
    var t = null;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (parsed.ok === true && typeof parsed.t === "number" && isFinite(parsed.t)) t = parsed.t;
        else return null;
      }
    } catch (e) {}
    if (t == null && /^\d+$/.test(String(raw))) t = Number(raw);
    if (t == null || !isFinite(t)) return null;
    var age = now - t;
    if (age < 0 || age >= MAX) return null;
    return t;
  }

  function stamp(t) {
    return JSON.stringify({ ok: true, t: t });
  }

  function drop(store) {
    try { store.removeItem(KEY); } catch (e) {}
  }

  var floor = document.querySelector(".bond-floor");
  var root = document.getElementById("bond-age-gate");

  function openFloor() {
    document.documentElement.dataset.bondAge = "ok";
    if (floor) floor.removeAttribute("inert");
    try { window.dispatchEvent(new CustomEvent("bond-entered")); } catch (e) {}
  }

  var now = Date.now();
  var localRaw = readStore(localStorage);
  var sessionRaw = readStore(sessionStorage);
  var localT = freshTime(localRaw, now);
  if (sessionRaw != null) drop(sessionStorage);

  if (localT != null) {
    openFloor();
    return;
  }
  if (localRaw) drop(localStorage);

  if (!root) return;

  var yesEl = document.getElementById("bond-age-yes");
  var noEl = document.getElementById("bond-age-no");
  var deniedEl = document.getElementById("bond-gate-denied-h");
  if (yesEl == null || noEl == null) return;

  function controlsIn(node) {
    var out = [];
    if (!node || !node.querySelectorAll) return out;
    var list = node.querySelectorAll("a[href], button, input, select, textarea");
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.disabled) continue;
      if (el.tabIndex < 0) continue;
      var st = window.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") continue;
      if (!el.getClientRects || el.getClientRects().length === 0) continue;
      out.push(el);
    }
    return out;
  }

  function onTab(ev) {
    if (ev.key !== "Tab") return;
    if (document.documentElement.getAttribute("data-bond-age") === "ok") return;
    var controls = controlsIn(root);
    if (!controls.length) {
      ev.preventDefault();
      return;
    }
    var idx = -1;
    for (var i = 0; i < controls.length; i++) {
      if (controls[i] === document.activeElement) { idx = i; break; }
    }
    var next;
    if (idx === -1) next = ev.shiftKey ? controls.length - 1 : 0;
    else if (ev.shiftKey) next = idx === 0 ? controls.length - 1 : idx - 1;
    else next = idx === controls.length - 1 ? 0 : idx + 1;
    ev.preventDefault();
    controls[next].focus();
  }

  function onFocusIn(ev) {
    if (document.documentElement.getAttribute("data-bond-age") === "ok") return;
    var t = ev.target;
    if (!t || t === document.body || t === document.documentElement) return;
    if (t === root || (root.contains && root.contains(t))) return;
    var controls = controlsIn(root);
    if (controls.length && document.activeElement !== controls[0]) controls[0].focus();
  }

  document.addEventListener("keydown", onTab, true);
  document.addEventListener("focusin", onFocusIn, true);

  var tries = 0;
  function focusYes() {
    if (yesEl) yesEl.focus({ preventScroll: true });
    tries += 1;
    if (document.activeElement === yesEl || tries >= 20) return;
    setTimeout(focusYes, 60);
  }
  setTimeout(focusYes, 60);

  function focusMain() {
    var query = document.querySelector;
    if (typeof query !== "function") return;
    var target = document.querySelector("main") || document.querySelector("h1");
    if (!target || typeof target.focus !== "function") return;
    if (typeof target.tabIndex === "number" && target.tabIndex < 0 && typeof target.setAttribute === "function") {
      target.setAttribute("tabindex", "-1");
    }
    try { target.focus({ preventScroll: true }); } catch (e) { try { target.focus(); } catch (err) {} }
  }

  yesEl.addEventListener("click", function () {
    var t = Date.now();
    try { localStorage.setItem(KEY, stamp(t)); } catch (e) {}
    try { sessionStorage.setItem(KEY, String(t)); } catch (e) {}
    openFloor();
    focusMain();
  });

  noEl.addEventListener("click", function () {
    root.setAttribute("data-declined", "true");
    root.setAttribute("aria-labelledby", "bond-gate-denied-h");
    if (deniedEl) deniedEl.focus();
  });
})();
