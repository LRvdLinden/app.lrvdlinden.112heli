"""Renders the og:images (1200x630, NL) from og.html into website/web/og/. Run: python3 website/og/render.py"""
import json, os, urllib.parse, subprocess
from playwright.sync_api import sync_playwright
D = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(D, "..", "web", "og"); os.makedirs(OUT, exist_ok=True)
PAGES = {
 "home": ("Alles wat vliegt voor de <b>hulpdiensten</b>. Live.", "Lifeliners, politiehelikopters, Kustwacht en Defensie op de kaart.", "112|Live kaart|Gratis app",
          [["heli_lifeliner_ec135",700,110,420,0],["heli_politie_ec135",740,330,380,1]]),
 "kaart": ("Live <b>kaart</b> met alle hulpdiensthelikopters", "Zie waar de Lifeliner, de Zulu en de Kustwacht nu vliegen.", "Live|Apple Kaarten",
          [["heli_politie_ec135",760,140,370,0],["lucht_kustwacht_aw189",740,360,380,1]]),
 "toestellen": ("Alle <b>toestellen</b> op een rij", "Lifeliner, Zulu, Kustwacht, Chinook, F-35 en meer, met waar ze nu zijn.", "17 soorten|Live status",
          [["heli_lifeliner_ec135",700,80,330,0],["lucht_chinook",790,250,340,1],["lucht_kustwacht_dash8",690,420,340,0]]),
}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--allow-file-access-from-files"])
    pg = b.new_page(viewport={"width": 1200, "height": 630})
    for name, (t, s, tags, c) in PAGES.items():
        qs = urllib.parse.urlencode({"t": t, "s": s, "tags": tags, "c": json.dumps(c)})
        pg.goto("file://" + os.path.join(D, "og.html") + "?" + qs); pg.wait_for_timeout(400)
        out = os.path.join(OUT, f"{name}.png"); pg.screenshot(path=out)
        subprocess.run(["python3", "-c", f"from PIL import Image; im=Image.open('{out}').convert('RGB').quantize(256, method=2, dither=0); im.save('{out}', optimize=True)"])
        print(name, os.path.getsize(out) // 1024, "KB")
    b.close()
