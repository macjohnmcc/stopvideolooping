# Stop Video Looping

A Chrome extension that stops videos from replaying on repeat. When a video
reaches the end it stays on its last frame instead of starting over.

| Site | Scope |
| --- | --- |
| instagram.com | every video |
| threads.com | every video |
| youtube.com | **Shorts only** (`/shorts`); regular videos are left alone |

## Install

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select this folder
4. Reload any open Instagram, Threads, or YouTube tab

## How it works

These sites mark their videos with the `loop` attribute and restart playback
from their own JavaScript whenever a video comes back into view, so removing the
attribute alone is not enough. For every `<video>` on the page the extension:

- clears `loop`, and clears it again if the site re-adds it
- pauses playback the moment `ended` fires, and blocks further `play()` calls for
  that video, so an automatic restart has no effect
- releases the block on your next click, tap, or keypress, so clicking play on a
  video still works normally

Videos are picked up three ways, because all three sites are single-page apps
that swap their players around: a `MutationObserver` on the page, a once-a-second
sweep that also reaches into open shadow roots (YouTube can mount its player
inside one), and a check of the current route, so YouTube only engages on
`/shorts`. The toolbar popup toggles the extension and reports how many replays
it has stopped on the current tab.

Note that a video that already finished will not replay when you scroll back to
it either — click it to play it again.

## Controls on Instagram

Instagram draws no controls of its own for feed videos, and its progress bar is
built from internal components that an extension cannot switch on. The popup's
**Show controls on Instagram** checkbox instead injects a small bar into the
video's container: a play/pause button, a draggable progress bar, and elapsed /
total time.

It is Instagram-only on purpose: Threads and YouTube already draw their own
controls, and two bars would overlap. Details worth knowing:

- the bar lives in a shadow root, so Instagram's stylesheet cannot reach it
- it appears on hover and while paused, and fades after 2.5 s of playback
- arrow keys step 5 s when the bar has focus; only one bar shows at a time
- Instagram's own tap-to-pause overlay still works, since the bar only covers
  the bottom strip
- pointer handling runs on the document in the capture phase and hit-tests the
  bar's own rectangles, so an overlay stacked over the video cannot swallow a drag
- after a seek the target is held for about a third of a second, because
  Instagram's own player sometimes snaps `currentTime` straight back

Turn the checkbox off to remove the bars.

## Tests

Two smoke tests run in any Chromium browser and print pass/fail into the page.

`test/player-ui.smoke.html` drives the injected bar against a stubbed video:
injection, play/pause, tapping and dragging the scrubber, keyboard nudging, the
fade-out gate, the seek hold, and attach/detach cleanup.

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --virtual-time-budget=3000 \
  --dump-dom "file://$PWD/test/player-ui.smoke.html"
```

`test/content.smoke.html` runs the real `content.js` against stubbed extension
APIs and checks the whole pipeline: guards land on videos, loop is neutralised,
bars are injected and cleaned up, and nothing throws. It needs to be served over
HTTP because it reads the script's source, and it points the page-scope check at
`instagram.com` rather than adding a test-only hook to shipped code.

```sh
python3 -m http.server 8731 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --virtual-time-budget=6000 \
  --dump-dom "http://127.0.0.1:8731/test/content.smoke.html"
kill %1
```

The virtual time budget lets the timed seek-hold checks finish before the DOM is
dumped.

## Files

| Path | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest, content script on Instagram, Threads, YouTube |
| `src/content.js` | Loop blocking, replay blocking, DOM watching |
| `src/player-ui.js` | The injected play/pause and progress bar for Instagram |
| `src/popup.html`, `src/popup.js`, `src/popup.css` | Toolbar popup and toggle |
| `build.py` | Packages `dist/stopvideolooping-<version>.zip` for the store |
| `test/player-ui.smoke.html` | Headless smoke test for the injected bar |
| `test/content.smoke.html` | Headless smoke test for the content script |
| `make-icons.py` | Regenerates `icons/` (requires Pillow) |

## Reinstall / edit

Press the reload button on the extension card in `chrome://extensions` after
editing any file here, then reload the Instagram tab.

## Build

```sh
python3 build.py     # macOS / Linux
py build.py          # Windows
npm run build        # same thing, if you have node installed
```

The zip contains only what Chrome needs, with `manifest.json` at its root:

```
manifest.json  src/content.js  src/popup.html  src/popup.css  src/popup.js  icons/*.png
```

The build fails if the manifest references a file that is not packaged, and warns
if `package.json` and the manifest versions disagree.

## Publish

1. Bump `"version"` in `manifest.json` (Chrome rejects a re-upload of a version
   that already exists), and in `package.json` to match
2. `python3 build.py`
3. Upload `dist/stopvideolooping-<version>.zip` at
   <https://chrome.google.com/webstore/devconsole>

`dist/` is git-ignored; nothing in it is needed for local development.

## Testing on Windows

Nothing in the extension is platform specific — it is plain JS, CSS, and HTML.
Copy this folder to the Windows machine and use **Load unpacked** there as in the
install steps above. Only the tooling (`build.py`, `make-icons.py`) needs Python;
to package on Windows without it, select `manifest.json`, `src`, and `icons` in
Explorer, right-click, and compress to a zip.