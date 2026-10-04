# Privacy Policy — Stop Video Looping

**Effective date: 4 October 2026**

Stop Video Looping is a browser extension that stops videos on Instagram, Threads
and YouTube Shorts from replaying automatically. It is open source and its source
code is public.

The short version: it collects nothing, it sends nothing anywhere, and the only
things it stores are your two checkbox choices, on your own machine.

## What the extension collects

Nothing. No personal information, no browsing history, no identifiers, no usage
or analytics data of any kind is collected, transmitted, sold or shared. There is
no account, and there is no server that the extension talks to.

## What the extension stores

Two settings, in your browser's local extension storage:

| Setting | Value |
| --- | --- |
| `enabled` | whether you want videos stopped from replaying |
| `controls` | whether you want the playback bar drawn on Instagram |

Both are simple on/off values. They never leave your device, they are not linked
to you or to anything else, and they are deleted when you clear the extension's
data or uninstall the extension. The count of replays stopped on the current tab
is shown in the popup while you are looking at it and is not stored at all.

## Network activity

The extension contains no network code. It makes no requests, opens no
connections and loads no remote code or data. Everything it does happens inside
the pages you already have open.

## Permissions, and what they are used for

| Permission | Why it is needed |
| --- | --- |
| Storage | To remember your two checkbox choices between visits |
| Access to instagram.com, threads.com and youtube.com | To find the video elements on those pages and stop them replaying |

Site access is requested for those three sites and no others. On those pages the
extension reads video elements, pauses a video the instant it finishes, stops the
page from restarting it, and — only if you switch it on — draws a playback bar
over an Instagram video. It does not read page text, images, messages, cookies
or anything else, and it does not collect the content of the pages you visit.

## Third parties

None. No advertising, no analytics, no third-party libraries that phone home, no
data sharing of any kind.

## Children

The extension is not directed at children and collects no data from anyone,
including children.

## Changes

If a future version changes how data is handled, this policy will be updated in
the extension's source repository with a new effective date, and the change will
be noted in the release notes for that version.

## Contact

Questions about this policy: **you fill in an email address here.**

## Source code

The full source of the extension, including this policy, is public and can be
read and verified at:

```
https://github.com/macjohnmcc/stopvideolooping
```

If any statement here does not match what the code does, the code is the truth
and the policy is the bug.