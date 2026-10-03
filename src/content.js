(() => {
  'use strict';

  const STORAGE_KEY = 'enabled';
  const GUARD_ATTR = 'data-stop-looping';
  const LOOP_ATTR = 'data-stop-looping-loop';

  let enabled = true;
  let replaysBlocked = 0;
  const blocked = new Set();

  chrome.storage.local.get(STORAGE_KEY).then(
    (stored) => setEnabled(stored[STORAGE_KEY]),
    () => {}
  );

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && STORAGE_KEY in changes) {
      setEnabled(changes[STORAGE_KEY].newValue);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'stop-looping:stats') return;
    sendResponse({
      enabled,
      replaysBlocked,
      videosWatched: document.querySelectorAll(`video[${GUARD_ATTR}]`).length,
    });
  });

  document.addEventListener('pointerdown', unblock, true);
  document.addEventListener('touchstart', unblock, true);
  document.addEventListener('keydown', unblock, true);

  function setEnabled(value) {
    enabled = value !== false;
    if (enabled) observe();
    else unblock();
    for (const video of document.querySelectorAll('video')) guard(video);
    if (!enabled) restoreLoops();
  }

  function unblock() {
    blocked.clear();
  }

  function guard(video) {
    if (video.hasAttribute(GUARD_ATTR)) return;
    video.setAttribute(GUARD_ATTR, '');
    video.setAttribute(LOOP_ATTR, video.loop ? 'true' : 'false');
    if (enabled) video.loop = false;

    const play = HTMLMediaElement.prototype.play.bind(video);

    Object.defineProperty(video, 'play', {
      configurable: true,
      value() {
        if (enabled && blocked.has(video)) return Promise.resolve();
        return play();
      },
    });

    video.addEventListener('ended', () => {
      if (!enabled) return;
      video.pause();
      blocked.add(video);
      replaysBlocked += 1;
      prune();
    });

    video.addEventListener('play', () => {
      if (enabled && blocked.has(video)) video.pause();
    });
  }

  function restoreLoops() {
    for (const video of document.querySelectorAll(`video[${LOOP_ATTR}]`)) {
      video.loop = video.getAttribute(LOOP_ATTR) === 'true';
    }
  }

  function guardTree(root) {
    if (!root?.querySelectorAll) return;
    if (root instanceof HTMLVideoElement) guard(root);
    for (const video of root.querySelectorAll('video')) guard(video);
  }

  function forgetTree(root) {
    if (!root?.querySelectorAll) return;
    if (root instanceof HTMLVideoElement) blocked.delete(root);
    for (const video of root.querySelectorAll('video')) blocked.delete(video);
  }

  function prune() {
    for (const video of blocked) {
      if (!video.isConnected) blocked.delete(video);
    }
  }

  function observe() {
    if (observe.running) return;
    const root = document.documentElement;
    if (!root) return;

    observe.running = true;
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes') {
          const target = record.target;
          if (enabled && target.tagName === 'VIDEO') target.loop = false;
          continue;
        }
        for (const node of record.addedNodes) guardTree(node);
        for (const node of record.removedNodes) forgetTree(node);
      }
    }).observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['loop'],
    });
  }

  guardTree(document);
  observe();
})();