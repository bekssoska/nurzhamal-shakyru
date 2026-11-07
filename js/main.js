/* Шақыру сайтының логикасы. Деректер config.js файлында. */
(function () {
  "use strict";

  var C = window.INVITE_CONFIG || {};
  var T = C.texts || {};
  var V = C.venue || {};

  var MONTHS = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым",
    "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];
  // Дүйсенбіден басталады
  var WEEKDAYS = ["дүйсенбі", "сейсенбі", "сәрсенбі", "бейсенбі", "жұма", "сенбі", "жексенбі"];
  var WD_SHORT = ["дс", "сс", "ср", "бс", "жм", "сн", "жс"];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function trim(s) { return String(s == null ? "" : s).replace(/^\s+|\s+$/g, ""); }

  /* ---------- Күн мен уақыт ---------- */
  var parts = String(C.date || "").split("-");
  var Y = +parts[0], M = +parts[1], D = +parts[2];
  var tz = C.timezone || "+05:00";
  var eventTime = new Date(C.date + "T" + (C.time || "00:00") + ":00" + tz).getTime();
  // Аптаның күні (0 = дүйсенбі) — UTC арқылы, құрылғының уақыт белдеуіне тәуелсіз
  var weekdayIdx = (new Date(Date.UTC(Y, M - 1, D)).getUTCDay() + 6) % 7;

  /* ---------- Мәтіндерді толтыру ---------- */
  var values = {};
  for (var k in T) { if (Object.prototype.hasOwnProperty.call(T, k)) values[k] = T[k]; }
  var units = T.countdownUnits || ["күн", "сағат", "минут", "секунд"];
  values.cdU0 = units[0]; values.cdU1 = units[1]; values.cdU2 = units[2]; values.cdU3 = units[3];
  values.name = C.name;
  values.time = C.time;
  values.venueVillage = V.village;
  values.venueName = V.name;
  values.mapLabel = V.mapLabel;
  values.dateDots = pad(D) + " . " + pad(M) + " . " + Y;
  values.dateShort = pad(D) + "." + pad(M) + "." + Y;
  values.dateLong = D + " " + MONTHS[M - 1] + " " + Y + ", " + WEEKDAYS[weekdayIdx];
  values.monthTitle = cap(MONTHS[M - 1]) + " " + Y;
  values.footer = C.name + " · " + values.dateShort;

  $$("[data-bind]").forEach(function (el) {
    var v = values[el.getAttribute("data-bind")];
    if (v != null && v !== "") el.textContent = v;
  });
  $$("[data-bind-placeholder]").forEach(function (el) {
    var v = values[el.getAttribute("data-bind-placeholder")];
    if (v) el.setAttribute("placeholder", v);
  });
  if (C.name && T.coverLabel) document.title = C.name + " — " + T.coverLabel;

  /* ---------- Жасы ---------- */
  var age = trim(C.age);
  if (age) {
    $("#ageNum").textContent = age;
    $("#age").hidden = false;
  }

  /* ---------- Карта ---------- */
  if (V.mapUrl) $("#mapLink").href = V.mapUrl;

  /* ---------- Фото ---------- */
  var photoEl = $("#photo");
  if (C.photo && photoEl) {
    photoEl.alt = C.name || "";
    photoEl.onload = function () {
      photoEl.hidden = false;
      photoEl.parentNode.className += " has-photo";
    };
    photoEl.onerror = function () { photoEl.remove ? photoEl.remove() : (photoEl.hidden = true); };
    photoEl.src = C.photo;
  }

  /* ---------- Әуен ---------- */
  var musicBtn = $("#musicBtn");
  var audio = null;
  var userPaused = false;

  function setPlaying(on) {
    musicBtn.classList.toggle("is-playing", on);
    musicBtn.setAttribute("aria-pressed", on ? "true" : "false");
    musicBtn.setAttribute("aria-label", on ? "Әуенді тоқтату" : "Әуенді қосу");
  }
  function playMusic() {
    if (!audio) return;
    var p = audio.play();
    if (p && p.catch) p.catch(function () { setPlaying(false); });
  }
  function enableMusic() {
    if (audio) return;
    audio = new Audio();
    audio.preload = "none";
    audio.loop = true;
    audio.src = C.music;
    audio.addEventListener("play", function () { setPlaying(true); });
    audio.addEventListener("pause", function () { setPlaying(false); });
    audio.addEventListener("error", function () {
      musicBtn.hidden = true;
      $("#coverHint").hidden = true;
    });
    musicBtn.hidden = false;
    $("#coverHint").hidden = false;
  }

  if (C.music) {
    // Файл бар-жоғын тексеру: жоқ болса батырма көрінбейді
    if (window.fetch && location.protocol !== "file:") {
      fetch(C.music, { method: "HEAD", cache: "no-store" })
        .then(function (r) {
          var type = r.headers.get("content-type") || "";
          if (r.ok && type.indexOf("text/html") === -1) enableMusic();
        })
        .catch(function () {});
    } else {
      var probe = new Audio();
      probe.preload = "metadata";
      probe.addEventListener("loadedmetadata", enableMusic);
      probe.src = C.music;
    }
  }

  musicBtn.addEventListener("click", function () {
    if (!audio) return;
    if (audio.paused) { userPaused = false; playMusic(); }
    else { userPaused = true; audio.pause(); }
  });

  // Мұқабаны түрту — әуенді қосады (автоплей жоқ)
  $("#cover").addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest(".cover__scroll")) return;
    if (audio && audio.paused && !userPaused) playMusic();
  });

  /* ---------- Күнтізбе ---------- */
  (function buildCalendar() {
    var grid = $("#calGrid");
    if (!grid || !Y) return;
    grid.setAttribute("aria-label", values.monthTitle);
    var html = "";
    var i;
    for (i = 0; i < 7; i++) html += '<div class="cal__wd" role="columnheader">' + WD_SHORT[i] + "</div>";
    var firstIdx = (new Date(Date.UTC(Y, M - 1, 1)).getUTCDay() + 6) % 7;
    var daysInMonth = new Date(Date.UTC(Y, M, 0)).getUTCDate();
    for (i = 0; i < firstIdx; i++) html += '<div class="cal__d" aria-hidden="true"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var col = (firstIdx + d - 1) % 7;
      var cls = "cal__d" + (col >= 5 ? " is-weekend" : "");
      if (d === D) {
        html += '<div class="' + cls + ' is-event" role="gridcell" aria-current="date" aria-label="' +
          values.dateLong + '"><svg class="cal__heart" aria-hidden="true"><use href="#heart"/></svg>' + d + "</div>";
      } else {
        html += '<div class="' + cls + '" role="gridcell">' + d + "</div>";
      }
    }
    grid.innerHTML = html;
  })();

  /* ---------- Кері санақ (UTC+5) ---------- */
  (function countdown() {
    var box = $("#countdown");
    var done = $("#countdownDone");
    var title = $("#cdTitle");
    var nums = {};
    $$("[data-cd]").forEach(function (el) { nums[el.getAttribute("data-cd")] = el; });
    var timer = null;

    function tick() {
      var diff = eventTime - Date.now();
      if (!(diff > 0)) {
        box.hidden = true;
        title.hidden = true;
        done.hidden = false;
        if (timer) clearInterval(timer);
        return;
      }
      var s = Math.floor(diff / 1000);
      nums.d.textContent = Math.floor(s / 86400);
      nums.h.textContent = pad(Math.floor(s % 86400 / 3600));
      nums.m.textContent = pad(Math.floor(s % 3600 / 60));
      nums.s.textContent = pad(s % 60);
    }
    tick();
    if (!done.hidden) return;
    timer = setInterval(tick, 1000);
  })();

  /* ---------- Сауалнама → WhatsApp ---------- */
  (function rsvp() {
    var form = $("#rsvpForm");
    var nameInput = $("#guestName");
    var wishInput = $("#guestWish");
    var optionsBox = $("#answerOptions");
    var errName = $("#errName");
    var errAnswer = $("#errAnswer");
    var fieldAnswer = $("#fieldAnswer");
    var hint = $("#rsvpHint");
    var hintLink = $("#rsvpLink");
    var phone = String(C.whatsapp || "").replace(/\D/g, "");

    (T.rsvpOptions || []).forEach(function (text, i) {
      var label = document.createElement("label");
      label.className = "opt";
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "answer";
      input.value = text;
      input.id = "answer" + i;
      var dot = document.createElement("span");
      dot.className = "opt__dot";
      dot.setAttribute("aria-hidden", "true");
      var span = document.createElement("span");
      span.textContent = text;
      label.appendChild(input);
      label.appendChild(dot);
      label.appendChild(span);
      optionsBox.appendChild(label);
    });

    function refreshChecked() {
      $$(".opt", optionsBox).forEach(function (l) {
        l.classList.toggle("is-checked", l.querySelector("input").checked);
      });
    }
    optionsBox.addEventListener("change", function () {
      refreshChecked();
      errAnswer.hidden = true;
      fieldAnswer.classList.remove("is-invalid");
    });
    nameInput.addEventListener("input", function () {
      if (trim(nameInput.value)) { errName.hidden = true; nameInput.removeAttribute("aria-invalid"); }
    });

    function buildMessage(name, answer, wish) {
      return [
        T.waHeader || "Туған күнге шақыруға жауап 🎉",
        (T.waName || "Аты-жөні") + ": " + name,
        (T.waAnswer || "Жауабы") + ": " + answer,
        (T.waWish || "Тілегі") + ": " + (wish || "—")
      ].join("\n");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = trim(nameInput.value);
      var checked = $("input[name=answer]:checked", form);
      var wish = trim(wishInput.value);
      var firstInvalid = null;

      if (!name) {
        errName.textContent = T.rsvpErrorName || "Аты-жөніңізді жазыңыз";
        errName.hidden = false;
        nameInput.setAttribute("aria-invalid", "true");
        firstInvalid = nameInput;
      }
      if (!checked) {
        errAnswer.textContent = T.rsvpErrorAnswer || "Бір жауапты таңдаңыз";
        errAnswer.hidden = false;
        fieldAnswer.classList.add("is-invalid");
        if (!firstInvalid) firstInvalid = $("input[name=answer]", form);
      }
      if (firstInvalid) {
        firstInvalid.focus();
        if (firstInvalid.scrollIntoView) firstInvalid.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }

      var url = "https://wa.me/" + phone + "?text=" + encodeURIComponent(buildMessage(name, checked.value, wish));
      hintLink.href = url;

      // Телефонда — WhatsApp қосымшасы, компьютерде — WhatsApp Web жаңа бетте ашылады
      var w = null;
      try { w = window.open(url, "_blank"); } catch (err) { w = null; }
      if (w) { try { w.opener = null; } catch (err2) {} }
      else { window.location.href = url; }

      hint.hidden = false;
      if (hint.scrollIntoView) hint.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });

    // Тест үшін: хабарлама сілтемесін құрастыру
    window.__buildWaUrl = function (name, answer, wish) {
      return "https://wa.me/" + phone + "?text=" + encodeURIComponent(buildMessage(name, answer, wish));
    };
  })();

  // Страховка: анимация жұмыс істемесе де, мұқаба 3 секундтан кейін көрінеді
  setTimeout(function () { document.documentElement.classList.add("anim-done"); }, 3200);

  /* ---------- Scroll-reveal ---------- */
  (function reveal() {
    var els = $$(".reveal");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  })();
})();
