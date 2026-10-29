"""Original illuminated Chinese storefront typography, shared in one texture atlas."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT = "C:/Windows/Fonts/msyhbd.ttc"
MONO = "C:/Windows/Fonts/consola.ttf"
entries = [
    ("雨巷", "RAIN DISTRICT", "WELCOME TO THE NEIGHBORHOOD", "#67ffe1"),
    ("修理所", "REPAIR / 021", "GOOD IDEAS. MADE HERE.", "#ffd399"),
    ("留声档案", "SIGNAL ARCHIVE", "TUNE INTO TOMORROW", "#78efff"),
    ("夜茶", "TEA AFTER HOURS", "THE KETTLE IS ALWAYS ON", "#ff8dc5"),
    ("末班车", "LAST TRAM / 00:40", "A LITTLE FURTHER TOGETHER", "#b6a0ff"),
    ("慢行", "TAKE YOUR TIME", "PEDESTRIAN GARDEN", "#ffe0a7"),
    ("巷口", "LANE 07", "STAY A LITTLE LONGER", "#ff9a7d"),
    ("收音机", "RADIO REPAIR", "FREQUENCIES / FRIENDS", "#69ffe3"),
]

atlas = Image.new("RGBA", (1024, 2048), "#0a1625")
small = ImageFont.truetype(MONO, 25)
micro = ImageFont.truetype(MONO, 17)

for index, (han, english, caption, color) in enumerate(entries):
    panel = Image.new("RGBA", (512, 512), "#0d1b2b")
    base = ImageDraw.Draw(panel)
    base.rounded_rectangle((10, 10, 502, 502), radius=28, fill="#101e30", outline=color, width=3)
    base.rounded_rectangle((21, 21, 491, 491), radius=21, outline="#344557", width=1)
    base.text((42, 44), f"RAIN DISTRICT    /    {index + 1:02}", font=micro, fill="#9aafbd")
    base.line((42, 83, 470, 83), fill="#3b5164", width=1)

    tubes = Image.new("RGBA", (512, 512))
    draw = ImageDraw.Draw(tubes)
    title = ImageFont.truetype(FONT, 152 if len(han) <= 2 else 107)
    bounds = draw.textbbox((0, 0), han, font=title)
    draw.text((256 - (bounds[2] - bounds[0]) / 2, 220 - (bounds[3] - bounds[1]) / 2 - bounds[1]), han, font=title, fill=color)
    bounds = draw.textbbox((0, 0), english, font=small)
    draw.text((256 - (bounds[2] - bounds[0]) / 2, 337), english, font=small, fill=color)
    draw.line((44, 395, 468, 395), fill=color, width=3)
    # Local tube bloom stays inside each cell; runtime HDR supplies the wider halo.
    halo = tubes.filter(ImageFilter.GaussianBlur(10))
    halo.putalpha(halo.getchannel("A").point(lambda alpha: int(alpha * 0.65)))
    panel = Image.alpha_composite(panel, halo)
    panel = Image.alpha_composite(panel, tubes)
    draw = ImageDraw.Draw(panel)
    draw.text((43, 426), caption, font=micro, fill="#bacbd4")
    draw.ellipse((44, 462, 50, 468), fill=color)
    draw.text((61, 455), "OPEN LATE", font=micro, fill=color)
    atlas.paste(panel, ((index % 2) * 512, (index // 2) * 512))

output = Path("public/models/neon-district/signs/atlas.png")
atlas.save(output, optimize=True)
print(f"Wrote {output}")
