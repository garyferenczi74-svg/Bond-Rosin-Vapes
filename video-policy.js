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

  var debug = false;
  try { debug = /(?:\?|&)bond_video_debug=1(?:&|$)/.test(location.search) || !!window.BOND_VIDEO_DEBUG; } catch (e) {}

  function log(kind, el, extra) {
    if (!debug && kind !== 'play-reject' && kind !== 'start-giveup' && kind !== 'endplate-error') return;
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
    if (el.getAttribute('data-loop') === '0') {
      fillPlate(el);
      el._bondFadeStarted = true;
      showPlate(el);
    } else {
      el.pause();
      el.style.opacity = '0';
    }
    var ev = el._bondFail;
    if (typeof ev === 'function') ev();
  }

  function silence(el) {
    if (el.muted !== true) el.muted = true;
    if (el.defaultMuted !== true) el.defaultMuted = true;
    if (el.volume !== 0) el.volume = 0;
    if (!el.hasAttribute('muted')) el.setAttribute('muted', '');
  }

  function wantedOf(el) {
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
    return wanted;
  }

  function currentIsWanted(el, wanted) {
    var cur = el.currentSrc || el.getAttribute('src') || '';
    if (!cur || !wanted.length) return false;
    for (var i = 0; i < wanted.length; i++) {
      if (wanted[i].src && cur.indexOf(wanted[i].src) !== -1) return true;
    }
    return false;
  }

  function fillSources(el) {
    var wanted = wantedOf(el);
    var existing = el.querySelectorAll('source');
    var same = existing.length === wanted.length;
    if (same) {
      for (var i = 0; i < wanted.length; i++) {
        if (existing[i].getAttribute('src') !== wanted[i].src) { same = false; break; }
      }
    }
    if (currentIsWanted(el, wanted) || same) return false;
    for (var j = existing.length - 1; j >= 0; j--) existing[j].parentNode.removeChild(existing[j]);
    el.removeAttribute('src');
    for (var k = 0; k < wanted.length; k++) {
      var s = document.createElement('source');
      s.setAttribute('src', wanted[k].src);
      s.setAttribute('type', wanted[k].type);
      el.appendChild(s);
    }
    try { el.load(); } catch (e) {}
    silence(el);
    return true;
  }

  function hygiene(el) {
    silence(el);
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
    if (el._bondPlateOn) return false;
    if (el.ended && el.getAttribute('data-loop') === '0') return false;
    return el._bondVisible === true;
  }

  function hasSources(el) {
    return !!(el.currentSrc || el.querySelector('source'));
  }

  function stop(el) {
    try { if (!el.paused) el.pause(); } catch (e) {}
    if (playing === el) playing = null;
  }

  function tryStart(el) {
    if (!canPlay(el)) return;
    if (!hasSources(el)) fillSources(el);
    if (playing && playing !== el) stop(playing);
    playing = el;
    silence(el);
    var p;
    try { p = el.play(); } catch (err) {
      log('play-throw', el, String(err));
      armRetries(el);
      return;
    }
    if (p && typeof p.then === 'function') {
      p.then(function () { el._bondPlayOk = true; }).catch(function (err) {
        log('play-reject', el, err && (err.name || String(err)));
        armRetries(el);
      });
    }
  }

  function start(el) {
    tryStart(el);
  }

  function armRetries(el) {
    if (!el._bondRetryBound) {
      el._bondRetryBound = true;
      function kick() { tryStart(el); }
      el.addEventListener('canplay', kick);
      el.addEventListener('canplaythrough', kick);
      el.addEventListener('loadeddata', kick);
    }
    if (!el._bondGestureBound) {
      el._bondGestureBound = true;
      function gest() {
        document.removeEventListener('touchstart', gest, true);
        document.removeEventListener('pointerdown', gest, true);
        tryStart(el);
      }
      document.addEventListener('touchstart', gest, { capture: true, passive: true });
      document.addEventListener('pointerdown', gest, { capture: true, passive: true });
    }
    if (!el._bondGiveup) {
      el._bondGiveup = setTimeout(function () {
        if (el._bondPlayOk || (el.paused === false && el.currentTime > 0)) return;
        log('start-giveup', el);
        fillPlate(el);
        el._bondFadeStarted = true;
        showPlate(el);
      }, 8000);
    }
  }

  function watchVisible(el) {
    if (el._bondWatching) return;
    el._bondWatching = true;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (typeof IntersectionObserver === 'function' && !el._bondIo) {
          var io = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
              onVisible(el, entries[i].intersectionRatio >= 0.25);
            }
          }, { threshold: [0, 0.25, 0.5, 1] });
          io.observe(el);
          el._bondIo = io;
        }
        var r = el.getBoundingClientRect();
        var vh = window.innerHeight || 0;
        var vis = r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < vh;
        if (vis || typeof IntersectionObserver !== 'function') onVisible(el, true);
        tryStart(el);
      });
    });
  }

  function platePic(el) {
    return el.parentNode ? el.parentNode.querySelector('.hero-endplate') : null;
  }

  function plateReady(el) {
    var pic = platePic(el);
    var img = pic ? pic.querySelector('img') : null;
    return !!(img && img.naturalWidth > 1);
  }

  function fillPlate(el) {
    var pic = platePic(el);
    if (!pic) return;
    var img = pic.querySelector('img');
    if (!img) return;
    if (pic.getAttribute('data-armed') === '1') return;
    pic.setAttribute('data-armed', '1');
    var wide = wideOf(el);
    var av = wide ? pic.getAttribute('data-desk-avif') : pic.getAttribute('data-mob-avif');
    var wp = wide ? pic.getAttribute('data-desk-webp') : pic.getAttribute('data-mob-webp');
    var jp = wide ? pic.getAttribute('data-desk-jpg') : pic.getAttribute('data-mob-jpg');
    function addSrc(type, set) {
      if (!set) return;
      var s = document.createElement('source');
      s.setAttribute('type', type);
      s.setAttribute('srcset', set);
      s.setAttribute('sizes', '100vw');
      pic.insertBefore(s, img);
    }
    addSrc('image/avif', av);
    addSrc('image/webp', wp);
    if (jp) img.setAttribute('src', jp.split(' ')[0]);
  }

  function showPlate(el) {
    if (el._bondPlateOn) return;
    if (!plateReady(el)) return;
    var pic = platePic(el);
    el._bondPlateOn = true;
    pic.classList.add('hero-endplate-on');
    window.setTimeout(function () {
      try { el.pause(); } catch (e) {}
      el.style.visibility = 'hidden';
    }, 400);
  }

  function armEndplate(el) {
    if (el.getAttribute('data-loop') !== '0') return;
    if (el._bondPlateBound) return;
    el._bondPlateBound = true;
    var pic = platePic(el);
    if (!pic) return;
    var img = pic.querySelector('img');
    if (!img) return;

    img.addEventListener('load', function () {
      if (el._bondFadeStarted || el.ended) showPlate(el);
    });
    img.addEventListener('error', function () {
      log('endplate-error', el);
    });

    el.addEventListener('canplaythrough', function () { fillPlate(el); });

    var plateRaf = 0;
    el.addEventListener('timeupdate', function () {
      if (plateRaf) return;
      plateRaf = requestAnimationFrame(function () {
        plateRaf = 0;
        var d = el.duration;
        if (!(d > 0.5)) return;
        if (el.currentTime >= (d - 0.4)) {
          if (!el._bondFadeStarted) {
            el._bondFadeStarted = true;
            fillPlate(el);
            showPlate(el);
          }
        }
      });
    });

    el.addEventListener('ended', function () {
      fillPlate(el);
      showPlate(el);
    });

    if (reduced || saveData) fillPlate(el);
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
      if (!reduced && !saveData && gateOpen) fillSources(el);
      el._bondWide = nowWide;
      watchVisible(el);
      tryStart(el);
      return;
    }
    el._bondBound = true;
    attached.push(el);
    hygiene(el);
    el.addEventListener('volumechange', function () { silence(el); });
    el.addEventListener('play', function () { silence(el); });
    el.addEventListener('playing', function () { silence(el); });
    el.addEventListener('loadeddata', function () { silence(el); });
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
    el.addEventListener('canplaythrough', function () { tryStart(el); });
    el.addEventListener('loadeddata', function () { tryStart(el); });
    el.addEventListener('canplay', function () { tryStart(el); });
    el.addEventListener('error', function () { failOpen(el, 'error'); });
    el.addEventListener('ended', function () {
      if (typeof el._bondEnded === 'function') el._bondEnded();
    });

    armEndplate(el);

    if (reduced || saveData) {
      posterOnly(el);
      var rp = platePic(el);
      if (rp) rp.classList.add('hero-endplate-on');
      if (typeof el._bondFail === 'function') el._bondFail();
      return;
    }

    if (!gateOpen) {
      el.style.opacity = '0';
      watchVisible(el);
      return;
    }

    el._bondWide = wideOf(el);
    fillSources(el);
    watchVisible(el);
  }

  function releaseGate() {
    gateOpen = true;
    for (var i = 0; i < attached.length; i++) {
      var el = attached[i];
      if (reduced || saveData) continue;
      hygiene(el);
      if (!el.currentSrc) fillSources(el);
      watchVisible(el);
      tryStart(el);
    }
  }

  function resetForBfcache(el) {
    el._bondPlateOn = false;
    el._bondFadeStarted = false;
    el._bondPlayOk = false;
    el.style.visibility = '';
    var pic = platePic(el);
    if (pic) pic.classList.remove('hero-endplate-on');
    if (el.getAttribute('data-loop') === '0') {
      try { el.currentTime = 0; } catch (e) {}
    }
    watchVisible(el);
    tryStart(el);
  }

  function boot() {
    var list = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < list.length; i++) attach(list[i]);
  }

  window.addEventListener('bond-entered', releaseGate);
  window.addEventListener('pageshow', function (ev) {
    if (!ev.persisted) return;
    for (var i = 0; i < attached.length; i++) resetForBfcache(attached[i]);
  });
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
