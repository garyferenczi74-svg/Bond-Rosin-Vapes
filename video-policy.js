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
    return el._bondVisible === true;
  }

  function stop(el) {
    try { if (!el.paused) el.pause(); } catch (e) {}
    if (playing === el) playing = null;
  }

  function start(el) {
    if (!canPlay(el)) return;
    if (el._bondPlateOn) return;
    if (el.ended && el.getAttribute('data-loop') === '0') return;
    if (playing && playing !== el) stop(playing);
    playing = el;
    silence(el);
    var p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () { log('play-reject', el); });
    }
  }

  function platePic(el) {
    return el.parentNode ? el.parentNode.querySelector('.hero-endplate') : null;
  }

  function plateReady(el) {
    var pic = platePic(el);
    var img = pic ? pic.querySelector('img') : null;
    return !!(img && img.naturalWidth > 1);
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

    function fillSources() {
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

    img.addEventListener('load', function () {
      if (el._bondFadeStarted || el.ended) showPlate(el);
    });
    img.addEventListener('error', function () {
      log('endplate-error', el);
    });

    el.addEventListener('canplaythrough', fillSources);

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
            fillSources();
            showPlate(el);
          }
        }
      });
    });

    el.addEventListener('ended', function () {
      fillSources();
      showPlate(el);
    });

    if (reduced || saveData) fillSources();
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
