"""Rendert de MV3-banners (NL) naar ../mv3-<datum>/nl/. Gebruik: python3 mv3/social/src/build.py"""
import asyncio, os
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("OUT") or os.path.join(D, "..", "mv3-2026-11-15", "nl")
# name: (w, h, css vars, route path in a 1000×1000 box)
JOBS = {
    "instagram-1080x1080": (1080, 1080, dict(m="72px", ty="72px", f="56px", tw="900px", cb="72px", gx="80%", gy="55%", jx="110px", jy="590px", jw="840px", jr="-6deg"),
                            "M60 900 C 300 640, 600 560, 960 600"),
    "instagram-1080x1350": (1080, 1350, dict(m="72px", ty="80px", f="58px", tw="900px", cb="80px", gx="78%", gy="62%", jx="100px", jy="800px", jw="880px", jr="-7deg"),
                            "M40 920 C 300 700, 620 620, 980 660"),
    "story-1080x1920": (1080, 1920, dict(m="80px", ty="290px", f="74px", tw="920px", cb="300px", gx="70%", gy="62%", jx="70px", jy="1120px", jw="930px", jr="-8deg"),
                        "M30 860 C 280 700, 620 640, 990 660"),
}
async def main():
    os.makedirs(OUT, exist_ok=True)
    src = open(os.path.join(D, "banner.html")).read()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, (w, h, v, route) in JOBS.items():
            css = ";".join(f"--{k}:{x}" for k, x in {**v, "w": f"{w}px", "h": f"{h}px"}.items())
            html = src.replace("<html>", f'<html style="{css}">').replace("ROUTE", route)
            tmp = os.path.join(D, f"_{name}.html"); open(tmp, "w").write(html)
            pg = await b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
            await pg.goto("file://" + tmp); await pg.wait_for_timeout(500)
            await pg.screenshot(path=os.path.join(OUT, f"{name}.png")); await pg.close(); os.remove(tmp)
            print(name)
        await b.close()
asyncio.run(main())
