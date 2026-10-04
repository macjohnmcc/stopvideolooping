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
**Show controls on Instagram** checkbox instead draws a small bar over the
video: a play/pause button, a draggable progress bar, and elapsed / total time.

It is Instagram-only on purpose: Threads and YouTube already draw their own
controls, and two bars would overlap. Details worth knowing:

- Threads draws a control bar for both the video behind an opened post and the zoomed
  one, so two slightly offset bars show up when a post is opened. Both belong to the
  site; nothing is drawn there by this extension.

- the bar lives in a shadow root, so Instagram's stylesheet cannot reach it
- it is fixed to the page and positioned from the video's own rectangle, because
  expanding a post restyles the video to fill the viewport while leaving its
  container where it was — anything positioned by that container ends up off
  screen, which is why it follows a click-to-expand but not a page refresh
- it appears whenever the pointer is over a video and while paused, and fades
  2.5 s after the pointer leaves a playing video; hover is resolved from pointer
  coordinates, because Instagram raises its own overlay above the video on hover,
  which makes the video stop emitting pointer events
- where several videos sit under the pointer at once — the expanded player plus the
  feed behind it — the bar belongs to the largest, which is the one you are looking
  at, rather than whichever was attached first
- if Instagram swaps the player element, as its audio toggle does to the expanded
  post, the bar is handed to the new element instead of waiting for the pointer to
  move again; the sweep also attaches bars itself, so a player it mounts late still
  gets one
- when several videos overlap, a playing one wins over a bigger paused one, because
  Instagram pauses whatever sits behind the expanded post
- one bar per page rather than one per document: a post opened inside a same origin
  frame runs a second copy of this script, and the copies agree on the top window about
  which one may draw. Instagram does not frame its player today, so this is a safeguard
  rather than a fix for anything seen so far
- only one bar is ever visible: Instagram leaves the feed's videos mounted and
  playing behind the expanded player and pauses them as the modal opens, so a
  background video's own play and pause events must not light up a second bar
  underneath the one being looked at
- arrow keys step 5 s when the bar has focus; only one bar shows at a time
- Instagram's own tap-to-pause overlay still works, since the bar only covers
  the bottom strip
- only the play/pause button and the scrubber accept clicks; the rest of the bar is
  transparent to the pointer, and it starts to the right of Instagram's own bottom
  left mute button, so that button keeps working with the extension enabled
- pointer handling runs on the document in the capture phase and hit-tests the
  bar's own rectangles, so an overlay stacked over the video cannot swallow a drag
- after a seek the target is held for about a third of a second, because
  Instagram's own player sometimes snaps `currentTime` straight back

Turn the checkbox off to remove the bars.

## Tests

Two smoke tests run in any Chromium browser and print pass/fail into the page.

`test/player-ui.smoke.html` drives the injected bar against a stubbed video:
injection, geometry tracking as the video moves and resizes, hover show/hide with
overlapping videos, single visible bar, click-through bar, swapped player element,
late mounted player, play/pause, tapping
and dragging the scrubber, keyboard nudging, the fade-out gate, the seek hold,
and attach/detach cleanup. It also asserts that Instagram's own container is
never mutated.

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
| `STORE_LISTING.md` | Chrome Web Store listing copy, privacy answers, upload checklist |
| `PRIVACY.md` | Privacy policy text for the store listing |
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