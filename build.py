#!/usr/bin/env python3
"""Packages the extension into a zip that the Chrome Web Store accepts."""

import argparse
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
PACKAGE = ("manifest.json", "src", "icons")
SKIPPED_NAMES = {".DS_Store", "__pycache__"}


def fail(message):
    raise SystemExit(f"error: {message}")


def load_manifest():
    try:
        return json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        fail(f"manifest.json is unreadable: {error}")


def referenced(manifest):
    """Every file the manifest points at, so packaging drift is caught."""
    paths = set()
    action = manifest.get("action", {})
    if action.get("default_popup"):
        paths.add(action["default_popup"])
    for group in (manifest.get("icons", {}), action.get("default_icon", {})):
        paths.update(group.values())
    for script in manifest.get("content_scripts", []):
        paths.update(script.get("js", []))
        paths.update(script.get("css", []))
    return sorted(paths)


def collect():
    files = []
    for entry in PACKAGE:
        path = ROOT / entry
        if path.is_dir():
            files.extend(
                child
                for child in sorted(path.rglob("*"))
                if child.is_file()
                and child.name not in SKIPPED_NAMES
                and child.suffix != ".pyc"
            )
        elif path.is_file():
            files.append(path)
        else:
            fail(f"{entry} is missing")
    return files


def warn_on_version_drift(manifest):
    try:
        published = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    if published.get("version") != manifest["version"]:
        print(
            f"warning: package.json version {published.get('version')} "
            f"does not match manifest version {manifest['version']}"
        )


def shown(path):
    """Path relative to the project root when it lives inside it."""
    try:
        return path.resolve().relative_to(ROOT)
    except ValueError:
        return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, help="output zip path")
    args = parser.parse_args()

    manifest = load_manifest()
    warn_on_version_drift(manifest)

    files = collect()
    packaged = {file.relative_to(ROOT).as_posix() for file in files}
    missing = [path for path in referenced(manifest) if path not in packaged]
    if missing:
        fail(f"manifest references files that are not packaged: {', '.join(missing)}")

    out = args.out or DIST / f"stopvideolooping-{manifest['version']}.zip"
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in files:
            archive.write(file, file.relative_to(ROOT).as_posix())

    with zipfile.ZipFile(out) as archive:
        if archive.testzip() is not None:
            fail("the zip is corrupt")
        names = sorted(archive.namelist())
    if "manifest.json" not in names:
        fail("manifest.json must sit at the root of the zip")

    print(f"built {shown(out)} ({len(names)} files, {out.stat().st_size:,} bytes)")
    for name in names:
        print(f"  {name}")


if __name__ == "__main__":
    main()