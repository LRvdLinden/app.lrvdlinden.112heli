#!/usr/bin/env python3
"""Renders the App Store images of 112Heli (nl-NL only: the app is Dutch only) into AppStore/.

The screens are rebuilt in HTML from the SwiftUI code (tools/appstore/template.html) and rendered with Playwright.
Run: python3 tools/appstore/build.py [only-these-prefixes ...]
"""
import json
import os
import sys
import urllib.parse

from PIL import Image
from playwright.sync_api import sync_playwright

D = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("OUT") or os.path.join(D, "..", "..", "AppStore")

PHONE = [  # (screen, title, sub)
    ("kaart", "Alles wat vliegt voor de <b>hulpdiensten</b>", "Live op de kaart"),
    ("kaart_kaart", "Waar vliegt de <b>Lifeliner</b> nu?", "Route, hoogte, snelheid en waar hij was"),
    ("toegangsscherm", "Melding bij <b>opstijgen</b>", "En volg een toestel op je toegangsscherm"),
    ("toestellen", "Lifeliner, Zulu en <b>Kustwacht</b>", "In de lucht, op de basis of uit beeld"),
    ("instellingen", "Jouw zones, jouw <b>meldingen</b>", "Weet wat er boven je wijk vliegt"),
    ("historie", "Alle vluchten van <b>30 dagen</b>", "Van opstijgen tot landingsplek"),
    ("max", "En volg <b>Max Verstappen</b>", "Zijn jet staat er gewoon tussen"),
]
PAD = [
    ("kaart", "Alles wat vliegt voor de <b>hulpdiensten</b>", "Live op de kaart, ook op je iPad"),
    ("kaart_kaart", "Waar vliegt de <b>Lifeliner</b> nu?", "Route, hoogte, snelheid en waar hij was"),
    ("toestellen", "Lifeliner, Zulu en <b>Kustwacht</b>", "In de lucht, op de basis of uit beeld"),
    ("instellingen", "Jouw zones, jouw <b>meldingen</b>", "Weet wat er boven je wijk vliegt"),
    ("historie", "Alle vluchten van <b>30 dagen</b>", "Van opstijgen tot landingsplek"),
]
MAC = [
    ("mac_overzicht", "Alles wat vliegt voor de <b>hulpdiensten</b>", "Live op de kaart, ook op je Mac"),
    ("mac_kaart", "Waar vliegt de <b>Lifeliner</b> nu?", "Route, hoogte, snelheid en waar hij was"),
]
TV = [("tv_kaart", "", ""), ("tv_toestellen", "", "")]

JOBS = []
for i, (s, t, sub) in enumerate(PHONE, 1):
    for name, (w, h) in {"iphone-6.3": (1206, 2622), "iphone-6.1": (1179, 2556)}.items():
        JOBS.append((f"screenshots/nl-NL/{name}/{i:02d}_{s}_{w}x{h}.png", dict(kind="iphone", screen=s, title=t, sub=sub, W=w, H=h), [(w, h)]))
for i, (s, t, sub) in enumerate(PAD, 1):
    for name, (w, h) in {"ipad-13": (2064, 2752), "ipad-12.9": (2048, 2732)}.items():
        JOBS.append((f"screenshots/nl-NL/{name}/{i:02d}_{s}_{w}x{h}.png", dict(kind="ipad", screen=s, title=t, sub=sub, W=w, H=h), [(w, h)]))
for i, (s, t, sub) in enumerate(MAC, 1):
    JOBS.append((f"screenshots/nl-NL/mac/{i:02d}_{s.replace('mac_', '')}_{{w}}x{{h}}.png", dict(kind="mac", screen=s, title=t, sub=sub, W=2880, H=1800),
                 [(2880, 1800), (2560, 1600), (1440, 900), (1280, 800)]))
for i, (s, _, _) in enumerate(TV, 1):
    JOBS.append((f"screenshots/nl-NL/appletv/{i:02d}_{s.replace('tv_', '')}_{{w}}x{{h}}.png", dict(kind="tv", screen=s, title="", sub="", W=1920, H=1080),
                 [(3840, 2160), (1920, 1080)]))
for kind, sizes in {"header": [(5244, 2950), (3840, 1646)], "search": [(5244, 2950), (3840, 2560), (1920, 1280)]}.items():
    for (w, h) in sizes:
        JOBS.append((f"marketing/nl-NL/{kind}_{w}x{h}.png", dict(kind=kind, screen="", title="", sub="", W=w // 2, H=h // 2), [(w, h)]))


def render(page, params, scale):
    page.set_viewport_size({"width": params["W"], "height": params["H"]})
    page.goto("file://" + os.path.join(D, "template.html") + "#" + urllib.parse.quote(json.dumps(params)))
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(300)
    return page.screenshot(type="png")


def main():
    only = sys.argv[1:]
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--allow-file-access-from-files"])
        for path, params, sizes in JOBS:
            if only and not any(o in path for o in only):
                continue
            w0, h0 = sizes[0]
            scale = w0 / params["W"]
            ctx = b.new_context(device_scale_factor=scale)
            pg = ctx.new_page()
            raw = render(pg, params, scale)
            ctx.close()
            tmp = "/tmp/_as.png"
            open(tmp, "wb").write(raw)
            im = Image.open(tmp).convert("RGB")
            for (w, h) in sizes:
                out = os.path.join(OUT, path.format(w=w, h=h))
                os.makedirs(os.path.dirname(out), exist_ok=True)
                (im if im.size == (w, h) else im.resize((w, h), Image.LANCZOS)).save(out, optimize=True)
                print(os.path.relpath(out, OUT))
        b.close()


if __name__ == "__main__":
    main()
