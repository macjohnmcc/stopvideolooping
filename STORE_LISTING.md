# Chrome Web Store listing copy — Stop Video Looping

Everything below is paste-ready for the listing form at
<https://chrome.google.com/webstore/devconsole>. Only the fields marked **you
fill in** need anything from you.

The manifest already supplies the name, the version, a one-line description and
the 16/32/48/128 icons, so Chrome prefills the title, the short description and
the store icon from `manifest.json`. Everything else lives here.

## Before the first upload

- Chrome rejects a re-upload of a version number it has already seen. `1.2.0`
  has not been published yet, so it can go up as is; if it has been, bump
  `"version"` in `manifest.json` **and** `package.json` to `1.2.1`, then rebuild.
- Run the smoke tests and the build:

  ```sh
  "/Applications/Opera.app/Contents/MacOS/Opera" --headless=new --disable-gpu \
    --no-first-run --virtual-time-budget=12000 \
    --dump-dom "file://$PWD/test/player-ui.smoke.html"
  python3 -m http.server 8731 &
  "/Applications/Opera.app/Contents/MacOS/Opera" --headless=new --disable-gpu \
    --no-first-run --virtual-time-budget=6000 \
    --dump-dom "http://127.0.0.1:8731/test/content.smoke.html"
  kill %1
  python3 build.py
  ```

  Expect `43/43 passed`, `8/8 passed`, and
  `built dist/stopvideolooping-1.2.0.zip (10 files, ...)`.
- Upload `dist/stopvideolooping-1.2.0.zip`. `manifest.json` is at its root and
  the archive holds only `manifest.json`, `src/` and `icons/`.

## Listing details

**Name** (18/45 characters, prefilled from the manifest)

```
Stop Video Looping
```

**Short description** (111/132 characters, prefilled from the manifest, safe to
replace with this)

```
Stops videos on Instagram, Threads and YouTube Shorts from replaying, with an optional scrub bar for Instagram.
```

**Category**

```
Social
```

Alternatives if `Social` feels wrong: `Fun`, `Productivity`, or `YouTube Tools`.

**Tags / keywords**

```
instagram, threads, youtube shorts, stop loop, no repeat, autoplay, video, scrub bar
```

**Language**

```
English (United States)
```

**Single purpose statement** (the dashboard asks for one sentence)

```
Stops videos on Instagram, Threads and YouTube Shorts from replaying automatically.
```

## Detailed description

```
Videos on Instagram, Threads and YouTube Shorts replay on repeat by default, so a
clip you have already watched starts again the moment it ends. Stop Video Looping
ends the video on its last frame instead.

WHAT IT DOES

- Stops a video from starting over when it reaches the end.
- Works on Instagram, Threads and YouTube Shorts. Regular YouTube videos are left
  alone, so nothing changes on the rest of YouTube.
- Keeps up with the page: all three sites swap their players around as you
  scroll, open a post or move between tabs, and the extension follows, including
  videos mounted inside shadow roots.
- Releases the block on your next click, tap or keypress, so pressing play still
  works normally.
- Leaves a finished video alone when you scroll back to it, instead of replaying
  it behind you.

OPTIONAL CONTROLS ON INSTAGRAM

Instagram draws no controls of its own for videos in the feed, so the popup's
"Show controls on Instagram" checkbox draws a small bar over the video instead: a
play/pause button, a draggable progress bar, and elapsed and total time. It
appears while the pointer is over a video and while it is paused, and fades out
when you move away from a playing one. Instagram's own mute button and its
tap-to-pause overlay keep working, and only the bar's own button and scrubber
catch the pointer.

Threads and YouTube already draw their own controls, so nothing is added there.

PRIVACY

Nothing leaves your browser. The extension contains no network code at all,
collects nothing, and the only thing it ever writes is your two checkbox choices,
which stay in local storage on your own machine.

It asks for access to instagram.com, threads.com and youtube.com because that is
where it has to work to find the videos, and for no other site.

PERMISSIONS

- Storage: remembers whether you want replays stopped, and whether you want the
  Instagram bar.
- Site access for Instagram, Threads and YouTube: reads and controls the video
  elements on those pages, and nothing else.

There is no account, no tracking, no analytics and no remote code.
```

## Screenshots

Chrome shows these in the store listing, so capture them at **1280×800**. Suggested
set, in this order, which is the order they appear:

1. Instagram feed video with the extension's bar showing over it, the scrubber
   dragged part way, elapsed and total time visible.
2. The same video expanded to fill the screen, bar still in place.
3. The popup open on Instagram, showing both checkboxes.
4. A Threads video sitting on its last frame, with the popup's stop toggle off.
5. A YouTube Shorts sitting on its last frame.

Screenshots 1 and 2 are the ones that sell it; 3 shows there is nothing to learn.
Avoid screenshots that show the two-bar situation on a zoomed Instagram post.

## Privacy practices

Chrome's data-usage questionnaire is mandatory for every listing. This extension
is honest to answer "no" across the board:

| Question | Answer |
| --- | --- |
| Do you collect or share user data? | No |
| Data categories | none |
| Is data sold or transferred to third parties? | No |
| Is data used for ads or credit/lending? | No |
| Remote code | No, all code ships inside the package |
| Encryption in transit | Not applicable, nothing is transmitted |

**Why the host permissions** — paste this if a reviewer asks:

```
The extension has to find <video> elements on instagram.com, threads.com and
youtube.com in order to stop their automatic replay, so it requests access to
exactly those three sites and no others. All processing happens in the page; no
data is sent anywhere.
```

**Privacy policy URL** — the policy text is written and checked in
`PRIVACY.md`. Fill in the contact address at the bottom, then publish it. The
repo URL works as-is today:

```
https://github.com/macjohnmcc/stopvideolooping/blob/main/PRIVACY.md
```

If you would rather have a clean domain, drop the file on any static host, or add
a `gh-pages` branch or a `/docs` folder, and use that URL instead. Chrome requires
a policy only when the questionnaire answers indicate user data is handled;
declaring none is accurate here, but a public policy is worth having either way.

**Support email**, **support website**, **homepage** — **you fill in.** The same
address in the policy can be reused.

## Distribution

`Public` puts the listing in search and the store front page. `Unlisted` gives
you a shareable install link that only works if you pass it on, which is the
easier option while you are still watching reviews.

## After publishing

- Uploading a new version needs a version bump; Chrome never accepts the same
  number twice.
- Each upload is reviewed, which for a first submission typically takes a few
  days. A rejection usually names the field at fault, so fix that field and
  re-upload rather than changing anything else.