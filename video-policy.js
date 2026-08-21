/* Bond site-wide background video policy (Prompt 6a). Native video only. */
(function (global) {
  var SELECTOR = 'video[data-bond-video]';
  var playing = null;
  var attached = [];
  var reduced = false;
  var saveData = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  try { saveData = !!(navigator.connection && navigator.connection.saveData); } catch (e) {}
  var gateOpen = false;
  try { if (sessionStorage.getItem('bond_age_ok')) gateOpen = true; } catch (e) {}

  function log(kind, el, extra) {
    try { console.warn('[bond-video]', kind, el && el.id, extra || ''); } catch (e) {}
  }

  function wideOf(el) {
    var q = el.getAttribute('data-wide-mq') || '(min-width: 768px)';
    try { return window.matchMedia(q).matches; } catch (e) { return (window.innerWidth || 0) >= 768; }
  }

  function posterOnly(el) {
    el.pause();
    el.removeAttribute('src');
    var nodes = el.querySelectorAll('source');
    for (var i = 0; i < nodes.length; i++) nodes[i].parentNode.removeChild(nodes[i]);
    try { el.load(); } catch (e) {}
    el.style.opacity = '0';
  }

  function failOpen(el, why) {
    log(why, el);
    el.pause();
    el.style.opacity = '0';
    var ev = el._bondFail;
    if (typeof ev === 'function') ev();
  }

  function fillSources(el) {
    var wide = wideOf(el);
    var webm = wide ? el.getAttribute('data-desktop-webm') : el.getAttribute('data-mobile-webm');
    var mp4 = wide ? el.getAttribute('data-desktop-mp4') : el.getAttribute('data-mobile-mp4');
    var small = el.getAttribute('data-small-mp4');
    var w = window.innerWidth || 0;
    if (small && w > 0 && w < 768 && wide === false && el.getAttribute('data-use-small') === '1') {
      mp4 = small;
      webm = '';
    }
    var wanted = [];
    if (webm) wanted.push({ src: webm, type: 'video/webm' });
    if (mp4) wanted.push({ src: mp4, type: 'video/mp4' });
    var existing = el.querySelectorAll('source');
    var same = existing.length === wanted.length;
    if (same) {
      for (var i = 0; i < wanted.length; i++) {
        if (existing[i].getAttribute('src') !== wanted[i].src) { same = false; break; }
      }
    }
    if (same) return false;
    for (var j = existing.length - 1; j >= 0; j--) existing[j].parentNode.removeChild(existing[j]);
    el.removeAttribute('src');
    for (var k = 0; k < wanted.length; k++) {
      var s = document.createElement('source');
      s.setAttribute('src', wanted[k].src);
      s.setAttribute('type', wanted[k].type);
      el.appendChild(s);
    }
    try { el.load(); } catch (e) {}
    return true;
  }

  function hygiene(el) {
    el.muted = true;
    el.defaultMuted = true;
    el.volume = 0;
    el.setAttribute('muted', '');
    el.setAttribute('playsinline', '');
    el.playsInline = true;
    el.disablePictureInPicture = true;
    el.controls = false;
    el.removeAttribute('controls');
    if (el.getAttribute('data-loop') !== '0') {
      el.loop = true;
      el.setAttribute('loop', '');
    } else {
      el.loop = false;
    }
    var hero = el.getAttribute('data-hero') === '1';
    el.preload = hero ? 'auto' : 'metadata';
    el.setAttribute('preload', el.preload);
    var wide = wideOf(el);
    var poster = wide ? el.getAttribute('data-desktop-poster') : el.getAttribute('data-mobile-poster');
    if (poster) el.setAttribute('poster', poster);
  }

  function canPlay(el) {
    if (reduced || saveData) return false;
    if (!gateOpen) return false;
    if (document.hidden) return false;
    return el._bondVisible === true;
  }

  function stop(el) {
    try { if (!el.paused) el.pause(); } catch (e) {}
    if (playing === el) playing = null;
  }

  function start(el) {
    if (!canPlay(el)) return;
    if (playing && playing !== el) stop(playing);
    playing = el;
    el.muted = true;
    el.volume = 0;
    var p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () { log('play-reject', el); });
    }
  }

  function onVisible(el, vis) {
    el._bondVisible = vis;
    if (vis) start(el);
    else stop(el);
  }

  function attach(el) {
    if (el._bondBound) {
      hygiene(el);
      var nowWide = wideOf(el);
      if (el._bondWide !== nowWide && !reduced && !saveData && gateOpen) fillSources(el);
      el._bondWide = nowWide;
      return;
    }
    el._bondBound = true;
    attached.push(el);
    hygiene(el);
    el.style.transition = el.style.transition || 'opacity .6s cubic-bezier(0.44,0,0.56,1)';

    var stallTimer = 0;
    function clearStall() { if (stallTimer) { clearTimeout(stallTimer); stallTimer = 0; } }
    function armStall() {
      clearStall();
      stallTimer = setTimeout(function () { failOpen(el, 'stalled'); }, 3000);
    }

    el.addEventListener('waiting', armStall);
    el.addEventListener('playing', function () {
      clearStall();
      el.style.opacity = '1';
      el.classList.add('hero-vis');
    });
    el.addEventListener('canplaythrough', function () {
      if (canPlay(el) && el.paused) start(el);
    });
    el.addEventListener('loadeddata', function () {
      if (canPlay(el) && el.paused) start(el);
    });
    el.addEventListener('error', function () { failOpen(el, 'error'); });
    el.addEventListener('ended', function () {
      if (typeof el._bondEnded === 'function') el._bondEnded();
    });

    if (reduced || saveData) {
      posterOnly(el);
      if (typeof el._bondFail === 'function') el._bondFail();
      return;
    }

    if (!gateOpen) {
      el.style.opacity = '0';
      return;
    }

    el._bondWide = wideOf(el);
    fillSources(el);
    if (typeof IntersectionObserver === 'function') {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          onVisible(el, entries[i].intersectionRatio >= 0.25);
        }
      }, { threshold: [0, 0.25, 0.5, 1] });
      io.observe(el);
      el._bondIo = io;
    } else {
      onVisible(el, true);
    }
  }

  function releaseGate() {
    gateOpen = true;
    for (var i = 0; i < attached.length; i++) {
      var el = attached[i];
      if (reduced || saveData) continue;
      hygiene(el);
      if (!el.currentSrc) fillSources(el);
    }
  }

  function boot() {
    var list = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < list.length; i++) attach(list[i]);
  }

  window.addEventListener('bond-entered', releaseGate);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (playing) stop(playing);
    } else {
      for (var i = 0; i < attached.length; i++) {
        if (attached[i]._bondVisible) start(attached[i]);
      }
    }
  });
  window.addEventListener('resize', function () {
    for (var i = 0; i < attached.length; i++) {
      if (!reduced && !saveData && gateOpen) fillSources(attached[i]);
    }
  });

  if (typeof MutationObserver === 'function') {
    var mo = new MutationObserver(function () { boot(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.BondVideo = {
    attach: attach,
    boot: boot,
    release: releaseGate,
    posterOnly: posterOnly
  };
})(window);
