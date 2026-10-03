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

## Files

| Path | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest, content script on Instagram, Threads, YouTube |
| `src/content.js` | Loop blocking, replay blocking, DOM watching |
| `src/popup.html`, `src/popup.js`, `src/popup.css` | Toolbar popup and toggle |
| `build.py` | Packages `dist/stopvideolooping-<version>.zip` for the store |
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