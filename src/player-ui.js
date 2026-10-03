(() => {
  'use strict';

  const HIDE_DELAY = 2500;
  const SEEK_HOLD = 320;
  const PLAY_PATH = 'M8 5v14l11-7z';
  const PAUSE_PATH = 'M6 5h4v14H6zM14 5h4v14h-4z';
  const instances = new Map();
  const seekTimers = new Map();

  let dragging = null;

  const TEMPLATE = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        pointer-events: auto;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        font: 500 12px/1 -apple-system, system-ui, sans-serif;
        color: #fff;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      }
      button {
        all: unset;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        flex: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
        cursor: pointer;
      }
      button:hover { background: rgba(0, 0, 0, 0.7); }
      button:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
      svg { width: 13px; height: 13px; fill: currentColor; }
      .track {
        flex: 1;
        height: 16px;
        display: flex;
        align-items: center;
        cursor: pointer;
      }
      .rail {
        position: relative;
        width: 100%;
        height: 3px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.35);
      }
      .fill {
        position: absolute;
        inset: 0 auto 0 0;
        width: 0;
        border-radius: 2px;
        background: #fff;
      }
      .time {
        flex: none;
        font-variant-numeric: tabular-nums;
        opacity: 0.85;
      }
    </style>
    <div class="row">
      <button type="button" aria-label="Play">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PLAY_PATH}"></path></svg>
      </button>
      <div class="track" role="slider" aria-label="Seek" tabindex="0">
        <div class="rail"><div class="fill"></div></div>
      </div>
      <span class="time"></span>
    </div>`;

  /**
   * Instagram stacks an invisible tap layer over its videos, so pointer events on
   * the bar itself can be swallowed. These listeners sit in the capture phase on
   * the document and hit-test against the bar's own rectangles instead, which
   * nothing on the page can occlude.
   */
  document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: false });
  document.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
  document.addEventListener('pointerup', onPointerUp, { capture: true });
  document.addEventListener('pointercancel', () => (dragging = null), { capture: true });

  function onPointerDown(event) {
    const hit = hitTest(event.clientX, event.clientY);
    if (!hit) return;
    if (hit.part === 'button') toggle(hit.video);
    else if (hit.part === 'track') {
      dragging = hit;
      seek(hit.video, event.clientX);
    } else return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onPointerMove(event) {
    if (!dragging) return;
    seek(dragging.video, event.clientX);
    event.preventDefault();
    event.stopPropagation();
  }

  function onPointerUp(event) {
    if (!dragging) return;
    seek(dragging.video, event.clientX);
    dragging = null;
    event.stopPropagation();
  }

  function hitTest(x, y) {
    for (const [video, ui] of instances) {
      if (!video.isConnected || ui.bar.style.opacity === '0') continue;
      if (!inside(ui.bar.getBoundingClientRect(), x, y)) continue;
      if (inside(ui.button.getBoundingClientRect(), x, y)) return { video, part: 'button' };
      if (inside(ui.track.getBoundingClientRect(), x, y)) return { video, part: 'track' };
      return { video, part: 'bar' };
    }
    return null;
  }

  function inside(rect, x, y) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function clearHold(video) {
    clearInterval(seekTimers.get(video));
    seekTimers.delete(video);
  }

  function toggle(video) {
    clearHold(video);
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    const ui = instances.get(video);
    if (ui) ui.paint();
  }

  function seek(video, clientX) {
    const ui = instances.get(video);
    if (!ui) return;
    const rect = ui.track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;

    const target = ratio * video.duration;
    setCurrentTime(video, target);
    ui.paint();
    holdSeek(video, ui, target);
  }

  /**
   * Instagram drives its own player state and can snap currentTime straight back
   * after we set it, so the target is re-asserted for a moment. Playback moving
   * forwards is left alone; only a backwards jump or a paused position counts as
   * drift, otherwise the hold would fight normal playback.
   */
  function holdSeek(video, ui, target) {
    clearHold(video);
    let tries = 0;
    seekTimers.set(
      video,
      setInterval(() => {
        tries += 1;
        const drifted = video.paused || video.currentTime < target - 0.8;
        if (video.isConnected && drifted && Math.abs(video.currentTime - target) > 0.4) {
          setCurrentTime(video, target);
          if (ui) ui.paint();
        }
        if (tries * 40 >= SEEK_HOLD) clearHold(video);
      }, 40)
    );
  }

  function setCurrentTime(video, seconds) {
    try {
      video.currentTime = seconds;
    } catch {}
  }

  function attach(video) {
    if (instances.has(video)) return;
    const container = video.parentElement;
    if (!container) return;

    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    const bar = document.createElement('div');
    bar.style.cssText = [
      'position:absolute',
      'left:0',
      'right:0',
      'bottom:0',
      'z-index:2147483000',
      'opacity:0',
      'pointer-events:none',
      'transition:opacity 150ms ease',
    ].join(';');
    const shadow = bar.attachShadow({ mode: 'open' });
    shadow.innerHTML = TEMPLATE;

    const button = shadow.querySelector('button');
    const path = shadow.querySelector('path');
    const track = shadow.querySelector('.track');
    const fill = shadow.querySelector('.fill');
    const time = shadow.querySelector('.time');
    const abort = new AbortController();
    const listen = { signal: abort.signal };

    let hideTimer = 0;

    const paint = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const current = duration ? video.currentTime / duration : 0;
      fill.style.width = `${(current * 100).toFixed(2)}%`;
      track.setAttribute('aria-valuenow', String(Math.round(current * 100)));
      time.textContent = duration ? `${format(video.currentTime)} / ${format(duration)}` : '';
      const playing = !video.paused && !video.ended;
      path.setAttribute('d', playing ? PAUSE_PATH : PLAY_PATH);
      button.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    };

    const hide = () => {
      bar.style.opacity = '0';
    };

    const show = () => {
      bar.style.opacity = '1';
      clearTimeout(hideTimer);
      if (!video.paused) hideTimer = setTimeout(hide, HIDE_DELAY);
    };

    const restart = () => {
      paint();
      show();
    };

    button.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        toggle(video);
      },
      listen
    );

    track.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        event.stopPropagation();
        const step = event.key === 'ArrowRight' ? 5 : -5;
        const target = Math.min(video.duration, Math.max(0, video.currentTime + step));
        setCurrentTime(video, target);
        paint();
        holdSeek(video, { paint }, target);
      },
      listen
    );

    video.addEventListener('timeupdate', paint, listen);
    video.addEventListener('durationchange', paint, listen);
    video.addEventListener('loadedmetadata', paint, listen);
    video.addEventListener('play', restart, listen);
    video.addEventListener('pause', restart, listen);
    video.addEventListener('ended', restart, listen);
    container.addEventListener('pointermove', show, { ...listen, capture: true });
    container.addEventListener('pointerdown', show, { ...listen, capture: true });
    container.addEventListener('pointerleave', () => !video.paused && hide(), listen);

    container.append(bar);
    instances.set(video, { bar, abort, hide, paint, show, button, track, cancelHide: () => clearTimeout(hideTimer) });
    restart();
  }

  function detach(video) {
    const ui = instances.get(video);
    if (!ui) return;
    ui.cancelHide();
    ui.abort.abort();
    ui.bar.remove();
    clearInterval(seekTimers.get(video));
    seekTimers.delete(video);
    instances.delete(video);
  }

  /** Drops bars for videos that are gone, and hides the ones scrolled out of view. */
  function sync(live) {
    const alive = new Set(live);
    for (const video of instances.keys()) {
      if (!alive.has(video) || !video.isConnected) detach(video);
    }
    for (const [video, ui] of instances) {
      if (!inView(video)) ui.hide();
      else ui.paint();
    }
  }

  function inView(video) {
    const rect = video.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  }

  function format(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  window.stopLoopingUi = { attach, detach, sync };
})();