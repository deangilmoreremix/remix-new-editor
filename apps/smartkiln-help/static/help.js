(function () {
  var base = document.currentScript.dataset.base || "/";
  // copy buttons
  document.querySelectorAll("pre").forEach(function (pre) {
    var b = document.createElement("button"); b.className = "copy"; b.textContent = "Copy"; b.type = "button";
    b.onclick = function () { var c = pre.querySelector("code"); navigator.clipboard && navigator.clipboard.writeText((c || pre).innerText).then(function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1400); }); };
    pre.appendChild(b);
  });
  // mobile nav
  var side = document.querySelector(".side"), tog = document.querySelector(".navtoggle");
  if (tog) tog.onclick = function () { var o = side.hasAttribute("data-open"); side.toggleAttribute("data-open", !o); tog.setAttribute("aria-expanded", String(!o)); };
  // search
  var q = document.getElementById("q"), box = document.getElementById("results"), idx = null, sel = -1;
  function load() { return idx ? Promise.resolve(idx) : fetch(base + "assets/search-index.json").then(function (r) { return r.json(); }).then(function (j) { idx = j; return j; }); }
  function score(p, terms) { var s = 0; var t = p.t.toLowerCase(), d = (p.d || "").toLowerCase(), h = (p.h || "").toLowerCase(), x = (p.x || "").toLowerCase();
    for (var i = 0; i < terms.length; i++) { var w = terms[i], hit = 0; if (t.indexOf(w) >= 0) hit += 10; if (h.indexOf(w) >= 0) hit += 5; if (d.indexOf(w) >= 0) hit += 3; if (x.indexOf(w) >= 0) hit += 1; if (!hit) return 0; s += hit; } return s; }
  function snippet(p, terms) { var x = p.x || ""; var l = x.toLowerCase(); var at = -1; for (var i = 0; i < terms.length && at < 0; i++) at = l.indexOf(terms[i]); if (at < 0) return p.d || ""; var from = Math.max(0, at - 40); return (from ? "…" : "") + x.slice(from, from + 110) + "…"; }
  function show(list, terms) { sel = -1; box.innerHTML = ""; if (!list.length) { var li = document.createElement("li"); li.textContent = "No results"; li.style.padding = "8px 10px"; box.appendChild(li); box.hidden = false; return; }
    list.forEach(function (p) { var li = document.createElement("li"), a = document.createElement("a"); a.href = base + p.u; var t = document.createElement("strong"); t.textContent = p.t; var s = document.createElement("small"); s.textContent = snippet(p, terms); a.appendChild(t); a.appendChild(s); li.appendChild(a); box.appendChild(li); }); box.hidden = false; }
  if (q) {
    q.addEventListener("input", function () { var v = q.value.trim().toLowerCase(); if (v.length < 2) { box.hidden = true; return; } var terms = v.split(/\s+/); load().then(function (all) { var r = all.map(function (p) { return { p: p, s: score(p, terms) }; }).filter(function (x) { return x.s; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 8).map(function (x) { return x.p; }); show(r, terms); }); });
    q.addEventListener("keydown", function (e) { var items = box.querySelectorAll("a"); if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % (items.length || 1); items.forEach(function (a, i) { a.classList.toggle("on", i === sel); }); } else if (e.key === "Enter" && items[Math.max(sel, 0)]) items[Math.max(sel, 0)].click(); else if (e.key === "Escape") { box.hidden = true; q.blur(); } });
    document.addEventListener("keydown", function (e) { if (e.key === "/" && document.activeElement !== q && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); } });
    document.addEventListener("click", function (e) { if (!box.contains(e.target) && e.target !== q) box.hidden = true; });
  }
})();
