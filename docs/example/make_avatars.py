"""Generate the placeholder portraits used by the example squads PDF (no real people).

    cd backend && uv run python ../docs/example/make_avatars.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).parent / "avatars"
SIZE = 160
COLOURS = [(0, 160, 220), (0, 119, 168), (127, 205, 241), (60, 68, 86), (34, 31, 32), (228, 87, 46)]


def portrait(bg: tuple[int, int, int], skin: tuple[int, int, int]) -> Image.Image:
    big = SIZE * 4
    image = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 0, big - 1, big - 1), fill=bg)
    draw.ellipse((big * 0.36, big * 0.2, big * 0.64, big * 0.5), fill=skin)  # head
    draw.ellipse((big * 0.16, big * 0.58, big * 0.84, big * 1.25), fill=skin)  # shoulders
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
    image.putalpha(mask)
    return image.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    skins = [(244, 213, 186), (222, 170, 130), (181, 125, 90), (141, 94, 66)]
    for i, bg in enumerate(COLOURS):
        portrait(bg, skins[i % len(skins)]).save(OUT / f"{i + 1}.png")
    print(f"{len(COLOURS)} placeholder portraits in {OUT}")


if __name__ == "__main__":
    main()
