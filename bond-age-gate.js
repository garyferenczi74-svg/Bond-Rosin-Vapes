// In-page age gate for static pages. Same session key and age rule as AgeGate.dc.html.
// This file stays on the site origin. It does not load a third party script.
(function () {
  var KEY = "bond_age_ok";
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function bondAgeDecision(month, year, now) {
    if (month === "" || year === "") return "wait";
    var born = new Date(parseInt(year, 10), parseInt(month, 10), 1);
    var age = now.getFullYear() - born.getFullYear();
    if (now.getMonth() < born.getMonth()) age = age - 1;
    if (age >= 21) return "enter";
    return "decline";
  }

  try { localStorage.removeItem(KEY); } catch (e) {}

  function readAge() {
    try { return sessionStorage.getItem(KEY); } catch (e) { return null; }
  }

  var floor = document.querySelector(".bond-floor");
  var root = document.getElementById("bond-age-gate");

  function openFloor() {
    document.documentElement.setAttribute("data-bond-age", "ok");
    if (floor) floor.removeAttribute("inert");
    try { window.dispatchEvent(new CustomEvent("bond-entered")); } catch (e) {}
  }

  var stored = readAge();
  if (stored != null && stored !== "") {
    openFloor();
    return;
  }

  if (!root) return;

  var monthEl = document.getElementById("bond-age-month");
  var yearEl = document.getElementById("bond-age-year");
  var enterEl = document.getElementById("bond-age-enter");
  if (!monthEl || !yearEl || !enterEl) return;

  var nowYear = new Date().getFullYear();
  var y;
  for (var i = 0; i < MONTHS.length; i++) {
    var monthOpt = document.createElement("option");
    monthOpt.value = String(i);
    monthOpt.textContent = MONTHS[i];
    monthEl.appendChild(monthOpt);
  }
  for (y = nowYear; y >= nowYear - 100; y--) {
    var yearOpt = document.createElement("option");
    yearOpt.value = String(y);
    yearOpt.textContent = String(y);
    yearEl.appendChild(yearOpt);
  }

  function syncReady() {
    var ready = monthEl.value !== "" && yearEl.value !== "";
    enterEl.setAttribute("data-ready", ready ? "true" : "false");
  }

  monthEl.addEventListener("change", syncReady);
  yearEl.addEventListener("change", syncReady);

  enterEl.addEventListener("click", function () {
    var decision = bondAgeDecision(monthEl.value, yearEl.value, new Date());
    if (decision === "wait") return;
    if (decision === "enter") {
      try { sessionStorage.setItem(KEY, String(Date.now())); } catch (e) {}
      openFloor();
      return;
    }
    root.setAttribute("data-declined", "true");
  });
})();
