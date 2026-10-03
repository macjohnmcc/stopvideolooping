(() => {
  'use strict';

  const STORAGE_KEY = 'enabled';
  const CONTROLS_KEY = 'controls';
  const GUARD_ATTR = 'data-stop-looping';
  const LOOP_ATTR = 'data-stop-looping-loop';
  const SWEEP_INTERVAL = 1000;
  const OBSERVER_OPTIONS = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['loop'],
  };

  let userEnabled = true;
  let showControls = true;
  let active = false;
  let replaysBlocked = 0;
  let lastPath = location.pathname;
  const blocked = new Set();
  const shadowRoots = new Set();
  const watched = new Set();
  const observer = new MutationObserver(handleMutations);

  chrome.storage.local
    .get([STORAGE_KEY, CONTROLS_KEY])
    .then((stored) => {
      setUserEnabled(stored[STORAGE_KEY]);
      setShowControls(stored[CONTROLS_KEY]);
    }, () => {});

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (STORAGE_KEY in changes) setUserEnabled(changes[STORAGE_KEY].newValue);
    if (CONTROLS_KEY in changes) setShowControls(changes[CONTROLS_KEY].newValue);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'stop-looping:stats') return;
    sendResponse({
      enabled: userEnabled,
      active,
      replaysBlocked,
      host: location.hostname,
      videosWatched: scanRoots(`video[${GUARD_ATTR}]`).length,
    });
  });

  document.addEventListener('pointerdown', unblock, true);
  document.addEventListener('touchstart', unblock, true);
  document.addEventListener('keydown', unblock, true);
  addEventListener('popstate', sync);
  addEventListener('hashchange', sync);
  setInterval(sweep, SWEEP_INTERVAL);

  function setUserEnabled(value) {
    userEnabled = value !== false;
    sync();
  }

  function setShowControls(value) {
    showControls = value !== false;
    eachGuarded(applyControls);
  }

  /** Instagram ships no controls of its own; Threads and YouTube draw their own. */
  function wantsControls() {
    return showControls && active && location.hostname.endsWith('instagram.com');
  }

  function applyControls(video) {
    if (wantsControls()) window.stopLoopingUi.attach(video);
    else window.stopLoopingUi.detach(video);
  }

  /** YouTube is only in scope for Shorts; every other supported site is full width. */
  function appliesToPage() {
    const host = location.hostname;
    const isYouTube = host === 'youtube.com' || host.endsWith('.youtube.com');
    return !isYouTube || location.pathname.startsWith('/shorts');
  }

  function sync() {
    lastPath = location.pathname;
    const next = userEnabled && appliesToPage();
    if (next === active) return;

    active = next;
    if (!active) {
      observer.disconnect();
      watched.clear();
      unblock();
      eachGuarded((video) => {
        video.loop = video.getAttribute(LOOP_ATTR) === 'true';
        applyControls(video);
      });
      return;
    }

    watch(document);
    eachGuarded((video) => {
      video.loop = false;
      applyControls(video);
    });
    sweep();
  }

  /** Catches videos the observer missed, players swapped in, and new routes. */
  function sweep() {
    if (location.pathname !== lastPath) {
      sync();
      if (!active) return;
    }
    if (!active || document.hidden) return;

    findShadowRoots();
    const videos = scanRoots('video');
    for (const video of videos) guard(video);
    window.stopLoopingUi.sync(videos);
  }

  function handleMutations(records) {
    for (const record of records) {
      if (record.type === 'attributes') {
        if (active && record.target.tagName === 'VIDEO') record.target.loop = false;
        continue;
      }
      for (const node of record.addedNodes) {
        scan(node, 'video');
        findShadowRoots(node);
      }
      for (const node of record.removedNodes) forget(node);
    }
  }

  function watch(root) {
    if (watched.has(root)) return;
    watched.add(root);
    observer.observe(root, OBSERVER_OPTIONS);
  }

  /** YouTube can mount the video inside an open shadow root, so look there too. */
  function findShadowRoots(node = document) {
    if (node.shadowRoot) rememberShadowRoot(node.shadowRoot);
    if (!node.querySelectorAll) return;
    for (const element of node.querySelectorAll('*')) {
      if (element.shadowRoot) rememberShadowRoot(element.shadowRoot);
    }
  }

  function rememberShadowRoot(root) {
    shadowRoots.add(root);
    if (active) watch(root);
  }

  function prune() {
    for (const video of blocked) {
      if (!video.isConnected) blocked.delete(video);
    }
    for (const root of shadowRoots) {
      if (!root.host.isConnected) shadowRoots.delete(root);
    }
  }

  function roots() {
    return [document, ...shadowRoots];
  }

  function scanRoots(selector) {
    const found = [];
    for (const root of roots()) {
      for (const video of root.querySelectorAll(selector)) found.push(video);
    }
    return found;
  }

  function eachGuarded(callback) {
    for (const video of scanRoots(`video[${GUARD_ATTR}]`)) callback(video);
  }

  function scan(node, selector = 'video') {
    if (!node?.querySelectorAll) return;
    if (node instanceof HTMLVideoElement) guard(node);
    for (const video of node.querySelectorAll(selector)) guard(video);
  }

  function forget(node) {
    if (!node?.querySelectorAll) return;
    if (node instanceof HTMLVideoElement) forgetVideo(node);
    for (const video of node.querySelectorAll('video')) forgetVideo(video);
  }

  function forgetVideo(video) {
    blocked.delete(video);
    window.stopLoopingUi.detach(video);
  }

  function unblock() {
    blocked.clear();
  }

  function guard(video) {
    if (video.hasAttribute(GUARD_ATTR)) return;
    video.setAttribute(GUARD_ATTR, '');
    video.setAttribute(LOOP_ATTR, video.loop ? 'true' : 'false');
    if (active) video.loop = false;
    applyControls(video);

    const play = HTMLMediaElement.prototype.play.bind(video);

    Object.defineProperty(video, 'play', {
      configurable: true,
      value() {
        if (active && blocked.has(video)) return Promise.resolve();
        return play();
      },
    });

    video.addEventListener('ended', () => {
      if (!active) return;
      video.pause();
      blocked.add(video);
      replaysBlocked += 1;
      prune();
    });

    video.addEventListener('play', () => {
      if (active && blocked.has(video)) video.pause();
    });
  }

  sync();
})();
