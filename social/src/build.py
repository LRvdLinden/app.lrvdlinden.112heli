"""Renders the 112Heli social banners (NL) into social/112heli-<date>/nl/. Run: python3 social/src/build.py"""
import json, os, urllib.parse
from playwright.sync_api import sync_playwright
D = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(D, "..", "112heli-2026-11-14", "nl"); os.makedirs(OUT, exist_ok=True)
B = {
 "instagram-1080x1080": (1080, 1080, dict(m="72px", ty="70px", f="54px", tw="560px", rx="850px", ry="540px", rs="600px", cb="70px"),
     [["heli_lifeliner_ec135", 670, 340, 360, 0], ["heli_politie_ec135", 670, 570, 360, 1]]),
 "instagram-1080x1350": (1080, 1350, dict(m="72px", ty="80px", f="60px", tw="900px", rx="560px", ry="960px", rs="700px", cb="70px"),
     [["heli_lifeliner_ec135", 130, 800, 440, 0], ["heli_politie_ec135", 520, 960, 420, 1], ["lucht_kustwacht_aw189", 300, 1100, 280, 0]]),
 "story-1080x1920": (1080, 1920, dict(m="80px", ty="270px", f="62px", tw="900px", rx="540px", ry="1300px", rs="820px", cb="300px"),
     [["heli_lifeliner_ec135", 80, 1100, 460, 0], ["heli_politie_ec135", 520, 1260, 440, 1]]),
 "linkedin-1200x627": (1200, 627, dict(m="68px", ty="54px", f="46px", tw="640px", rx="930px", ry="320px", rs="560px", cb="54px", pd="none"),
     [["heli_lifeliner_ec135", 720, 110, 400, 0], ["heli_politie_ec135", 740, 330, 380, 1]]),
}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--allow-file-access-from-files"])
    for name, (w, h, v, c) in B.items():
        v.update(w=f"{w}px", h=f"{h}px")
        pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
        pg.goto("file://" + os.path.join(D, "banner.html") + "#" + urllib.parse.quote(json.dumps({"v": v, "c": c})))
        pg.wait_for_timeout(500); pg.screenshot(path=os.path.join(OUT, name + ".png")); pg.close(); print(name)
    b.close()
