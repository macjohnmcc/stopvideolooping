(() => {
  'use strict';

  const HIDE_DELAY = 2500;
  const SEEK_HOLD = 320;
  const PLAY_PATH = 'M8 5v14l11-7z';
  const PAUSE_PATH = 'M6 5h4v14H6zM14 5h4v14h-4z';
  const instances = new Map();
  const seekTimers = new Map();

  let dragging = null;
  let hovered = null;
  let activeVideo = null;

  /**
   * Only one bar is visible across the whole page, not just within this document. A post
   * that opens in a same origin frame runs a second copy of this script there, and both
   * copies would otherwise put a bar on screen, one for the video behind the frame and one
   * for the video inside it. The frames share a slot on the top window to say which one is
   * allowed a bar, and a frame that cannot reach the top window is left alone.
   */
  const root = (() => {
    try {
      return window.top;
    } catch {
      return window;
    }
  })();
  const token = {};

  function claim() {
    try {
      if (root.owner && root.owner !== token) return false;
      root.owner = token;
      return true;
    } catch {
      return true;
    }
  }

  function owns() {
    try {
      return !root.owner || root.owner === token;
    } catch {
      return true;
    }
  }

  function release() {
    try {
      if (root.owner === token) root.owner = null;
    } catch {}
  }

  /**
   * Exactly one bar is ever visible. Instagram keeps the feed's videos mounted and
   * playing behind the expanded player, and their play and pause events would
   * otherwise light up a second bar underneath the one being looked at.
   */
  function activate(video) {
    if (activeVideo === video) return;
    const previous = activeVideo && instances.get(activeVideo);
    if (previous) previous.hide();
    activeVideo = video;
  }

  const TEMPLATE = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        /* Instagram keeps its own mute button in the video's bottom left corner, so the
           bar starts to the right of it and nothing but the real controls take clicks. */
        padding: 8px 10px 8px 48px;
        pointer-events: none;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        font: 500 12px/1 -apple-system, system-ui, sans-serif;
        color: #fff;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      }
      button {
        all: unset;
        pointer-events: auto;
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
        pointer-events: auto;
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
  document.addEventListener('pointermove', onHover, { capture: true, passive: true });
  document.addEventListener('pointerdown', onHover, { capture: true, passive: true });
  document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: false });
  document.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
  document.addEventListener('pointerup', onPointerUp, { capture: true });
  document.addEventListener('pointercancel', () => (dragging = null), { capture: true });
  window.addEventListener('scroll', placeAll, { capture: true, passive: true });
  window.addEventListener('resize', placeAll, { passive: true });

  /**
   * Hover is resolved from the pointer's coordinates rather than from events on the
   * video itself. Instagram raises its own overlay above the video on hover, which
   * makes the video emit pointerleave and then never emit pointermove again, so an
   * event-driven bar disappears the moment the pointer touches a video.
   */
  function onHover(event) {
    if (!owns()) {
      const current = activeVideo && instances.get(activeVideo);
      if (current) current.hide();
      return;
    }
    let boxes = [];
    let under = [];
    for (const [video, ui] of instances) {
      if (!video.isConnected) continue;
      const rect = video.getBoundingClientRect();
      boxes.push([video, ui, rect]);
      if (inside(rect, event.clientX, event.clientY)) under.push([video, rect]);
    }
    // Several videos can sit under the pointer at once: the expanded player plus the
    // feed behind it.
    const found = pick(under);
    const previous = hovered;
    hovered = found;
    const current = found && boxes.find(([video]) => video === found)[1];
    // No early exit for an unchanged hit: Instagram can move or remount a video while
    // the pointer stays put, which leaves the bar transparent and needing to come back.
    if (current) {
      activate(found);
      current.show();
    } else if (previous) {
      const [, before] = boxes.find(([video]) => video === previous) || [];
      if (before && !previous.paused) before.hide();
    }
  }

  /**
   * Chooses the video a bar belongs to. A playing video beats a paused one, because
   * Instagram pauses whatever sits behind the expanded player, so the biggest box on
   * screen is not always the one being watched. Then the larger rect wins, and on a tie
   * the newest, which is the expanded player because Instagram mounts it after the feed.
   */
  function pick(candidates) {
    let best = null;
    let bestPlaying = -1;
    let bestArea = -1;
    for (const [video, rect] of candidates) {
      const playing = !video.paused && !video.ended ? 1 : 0;
      const area = rect.width * rect.height;
      if (playing > bestPlaying || (playing === bestPlaying && area >= bestArea)) {
        best = video;
        bestPlaying = playing;
        bestArea = area;
      }
    }
    return best;
  }

  function placeAll() {
    for (const ui of instances.values()) ui.place();
  }

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

    /**
     * The bar is fixed to the body and positioned from the video's own rectangle
     * rather than sitting inside Instagram's container. When a post is expanded,
     * Instagram restyles the video to fill the viewport while its parent stays
     * where it was, so anything positioned by that parent ends up off screen.
     */
    const bar = document.createElement('div');
    bar.style.cssText = [
      'position:fixed',
      'left:0',
      'bottom:0',
      'width:0',
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

    const set = (property, value) => bar.style.setProperty(property, value, 'important');

    const place = () => {
      if (!video.isConnected) {
        hide();
        return;
      }
      const rect = video.getBoundingClientRect();
      set('left', `${Math.round(rect.left)}px`);
      set('width', `${Math.round(rect.width)}px`);
      set('bottom', `${Math.round(Math.max(0, innerHeight - rect.bottom))}px`);
    };

    const paint = () => {
      place();
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const current = duration ? video.currentTime / duration : 0;
      fill.style.width = `${(current * 100).toFixed(2)}%`;
      track.setAttribute('aria-valuenow', String(Math.round(current * 100)));
      time.textContent = duration ? `${format(video.currentTime)} / ${format(duration)}` : '';
      const playing = !video.paused && !video.ended;
      path.setAttribute('d', playing ? PAUSE_PATH : PLAY_PATH);
      button.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    };

    const state = { visible: false };

    const hide = () => {
      set('opacity', '0');
      state.visible = false;
      if (video === activeVideo) release();
    };

    const show = () => {
      if (!claim()) return;
      place();
      set('opacity', '1');
      state.visible = true;
      clearTimeout(hideTimer);
      // Only fade once the pointer has left the video, otherwise the bar disappears
      // while it is being looked at or dragged.
      if (!video.paused && hovered !== video) hideTimer = setTimeout(hide, HIDE_DELAY);
    };

    const restart = () => {
      paint();
      // Only the video in front is allowed to change bar visibility.
      if (video === activeVideo) show();
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
    document.body.append(bar);
    instances.set(video, {
      bar,
      abort,
      hide,
      paint,
      place,
      show,
      state,
      button,
      track,
      cancelHide: () => clearTimeout(hideTimer),
    });
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
    if (activeVideo === video) {
      activeVideo = null;
      release();
    }
    if (hovered === video) hovered = null;
  }

  /**
   * Attaches bars for videos the observer missed, drops bars for videos that are gone,
   * repositions the rest and hides off-screen ones.
   */
  function sync(live) {
    const current = activeVideo && instances.get(activeVideo);
    if (current && !owns()) {
      current.hide();
      return;
    }
    const alive = new Set(live);
    // Instagram can mount the expanded player after its mutation records were delivered,
    // and a missed one leaves the bar tracking the feed video sitting behind it, so the
    // sweep attaches too rather than relying on the observer alone.
    for (const video of live) {
      if (video instanceof HTMLVideoElement) attach(video);
    }
    let orphaned = false;
    for (const video of instances.keys()) {
      if (!alive.has(video) || !video.isConnected) {
        if (video === activeVideo) orphaned = true;
        detach(video);
      }
    }
    let visible = [];
    for (const [video, ui] of instances) {
      const rect = video.getBoundingClientRect();
      if (!inView(rect)) {
        ui.hide();
        continue;
      }
      ui.place();
      ui.paint();
      visible.push([video, rect]);
      if (video !== activeVideo) ui.hide();
      else if (!ui.state.visible && video.paused) ui.show();
    }
    /**
     * Instagram can throw the player element away and mount a new one, for example when
     * the audio is toggled, which takes the visible bar's video with it. Hand the bar to
     * its replacement instead of leaving the screen empty until the pointer moves again.
     */
    const front = pick(visible);
    if (orphaned && front) {
      activate(front);
      instances.get(front).show();
    }
  }

  function inView(rect) {
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  }

  function format(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  window.stopLoopingUi = { attach, detach, sync };
})();