#!/usr/bin/env python3
"""Generates the extension icons into ./icons."""

from pathlib import Path

from PIL import Image, ImageDraw

SCALE = 8
SIZES = (16, 32, 48, 128)
TOP = (245, 133, 41)
BOTTOM = (225, 48, 108)
BAR = (26, 26, 26)


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius, fill=255)
    return mask


def draw(size):
    canvas = size * SCALE
    icon = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))

    gradient = Image.new("RGB", (1, canvas))
    for y in range(canvas):
        t = y / (canvas - 1)
        gradient.putpixel(
            (0, y),
            tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)),
        )
    icon.paste(gradient.resize((canvas, canvas)), (0, 0))
    icon.putalpha(rounded_mask(canvas, canvas * 0.22))

    draw = ImageDraw.Draw(icon)

    left, right = canvas * 0.34, canvas * 0.76
    draw.polygon(
        [(left, canvas * 0.24), (left, canvas * 0.76), (right, canvas * 0.5)], fill="white"
    )

    draw.line(
        (canvas * 0.2, canvas * 0.82, canvas * 0.82, canvas * 0.18),
        fill=BAR,
        width=round(canvas * 0.11),
    )

    return icon.resize((size, size), Image.LANCZOS)


def main():
    out = Path(__file__).resolve().parent / "icons"
    out.mkdir(exist_ok=True)
    for size in SIZES:
        draw(size).save(out / f"icon{size}.png")
        print(f"wrote icons/icon{size}.png")


if __name__ == "__main__":
    main()