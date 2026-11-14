#!/usr/bin/env python3
"""Builds the static pages of 112heli.lrvdlinden.app into website/web/ (one shared header and footer).

Run after changing a page: python3 website/tools/build.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
SITE = "https://112heli.lrvdlinden.app"
V = "1"  # cache-buster for css/js


OG = {  # page -> og image (NL), alt text
    "home": ("home", "112Heli: alles wat vliegt voor de hulpdiensten, live op de kaart"),
    "kaart": ("kaart", "Live kaart van 112Heli met de Lifeliner, de Zulu en de Kustwacht"),
    "toestellen": ("toestellen", "Alle toestellen van 112Heli op een rij"),
}
LASTMOD = "2026-11-14"  # change only when page content really changes
SITEMAP = ["/", "/kaart/", "/toestellen/", "/support/", "/privacy/"]
ORG = {"@type": "Organization", "@id": "https://lrvdlinden.app/#org", "name": "LRvdLinden", "url": "https://lrvdlinden.app",
       "sameAs": ["https://github.com/LRvdLinden"]}


def ld(*objs):
    return "".join(f'<script type="application/ld+json">{json.dumps({"@context": "https://schema.org", **o}, ensure_ascii=False)}</script>\n' for o in objs)


def crumbs(name, path):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "112Heli", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": name, "item": SITE + path}]}


def head(title, desc, path, extra="", og="home", robots=None):
    img, alt = OG[og]
    url = SITE + ("/" if path == "/404.html" else path)
    rob = f'<meta name="robots" content="{robots}">\n' if robots else ""
    return f"""<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
{rob}<meta property="og:type" content="website">
<meta property="og:site_name" content="112Heli">
<meta property="og:locale" content="nl_NL">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/og/{img}.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{SITE}/og/{img}.png">
<meta name="twitter:image:alt" content="{alt}">
<meta name="theme-color" content="#0d111c">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/Poppins-Bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css?v={V}">
<script src="/assets/js/config.js?v={V}"></script>
{extra}</head>
"""


def nav(active):
    def link(href, label, key, cls=""):
        cur = ' aria-current="page"' if key == active else ""
        return f'<a href="{href}" class="{cls}"{cur}>{label}</a>'
    return f"""<header class="nav"{' data-solid="1"' if active != "home" else ""}>
  <div class="wrap">
    <a class="brand" href="/"><img src="/assets/img/app-icon.png" alt="" width="34" height="34">112Heli</a>
    <nav class="nav-links" aria-label="Hoofdmenu">
      {link("/kaart/", "Live kaart", "kaart", "keep")}
      {link("/toestellen/", "Toestellen", "toestellen")}
      {link("/support/", "Hulp", "support")}
      <a class="nav-cta" href="/#download" data-appstore><span>Download</span></a>
    </nav>
  </div>
</header>
"""


LR_LOGO = """<svg class="lr" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="116" fill="#121726"/>
<path d="M132 146v224h100M292 370V146h48a62 62 0 0 1 0 124h-48M338 270l52 100" fill="none" stroke="#fff" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="404" cy="126" r="34" fill="#4c6bff" stroke="#121726" stroke-width="14"/></svg>"""

FOOTER = f"""<footer>
  <div class="wrap">
    <div class="foot">
      <div>
        <a class="brand" href="/"><img src="/assets/img/app-icon.png" alt="" width="34" height="34">112Heli</a>
        <p class="muted" style="margin-top:12px;max-width:30em">Alles wat vliegt voor de hulpdiensten, live: Lifeliners, politiehelikopters, Kustwacht, Defensie, Marechaussee en PH-GOV.</p>
        <nav aria-label="Voettekst">
          <a href="/kaart/">Live kaart</a><a href="/toestellen/">Toestellen</a><a href="/support/">Hulp</a><a href="/privacy/">Privacy</a>
        </nav>
      </div>
      <div>
        <p class="eyebrow">Ontdekken</p>
        <a class="more-apps" href="https://lrvdlinden.app" rel="noopener">
          {LR_LOGO}
          <span><b>Meer apps van de ontwikkelaar</b><small>Apps voor iPhone, iPad, Apple TV en Homey</small></span>
          <span class="go">Bekijk</span>
        </a>
      </div>
    </div>
    <div class="app-info">
      <img src="/assets/img/app-icon.png" alt="" width="56" height="56">
      <span>Versie: <span data-version>1.0.0</span></span>
      <span>© <span data-year>2026</span> 112Heli</span>
    </div>
    <p class="credits">Posities: adsb.lol (ODbL) · Ziekenhuizen en bases: OpenStreetMap (ODbL) · Plaatsen: PDOK · Kaart: Apple Kaarten.
    Een toestel dat zijn positie niet uitzendt, staat niet op de kaart.</p>
  </div>
</footer>
"""


def page(path, title, desc, active, body, script=None, extra_head="", footer=True, og="home", robots=None):
    js = f'<script type="module" src="/assets/js/{script}?v={V}"></script>\n' if script else '<script type="module">import { initChrome } from "/assets/js/core.js?v=' + V + '"; initChrome();</script>\n'
    html = head(title, desc, path, extra_head, og, robots) + "<body>\n" + nav(active) + body + (FOOTER if footer else "") + js + "</body>\n</html>\n"
    out = os.path.join(WEB, path.strip("/"), "index.html") if path != "/" else os.path.join(WEB, "index.html")
    if path.endswith(".html"):
        out = os.path.join(WEB, path.strip("/"))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w").write(html)


# ------------------------------------------------------------------ home
FEATURES = [
    ("🗺️", "Live kaart", "Alle hulpdiensttoestellen op Apple Kaarten, met route, hoogte, snelheid en koers."),
    ("🔔", "Melding bij opstijgen", "Een pushmelding als een Lifeliner of Zulu in jouw buurt de lucht in gaat, met een eigen helikoptergeluid."),
    ("📍", "Eigen zone", "Een melding als er iets boven jouw wijk of plaats vliegt, welk toestel het ook is."),
    ("🚨", "Meerdere heli's op één plek", "Staan twee of meer helikopters bij elkaar, niet bij een ziekenhuis of basis? Dan is er vaak iets groots aan de hand."),
    ("🏥", "Landingsplek", "Geland bij een ziekenhuis, terug op de basis of op locatie: je ziet het meteen, en in de vluchtenlijst."),
    ("🌫️", "Weer dat vliegen beperkt", "Bij mist, onweer of harde wind (KNMI) zie je dat er weinig helikopterinzet te verwachten is."),
    ("⭐", "Favorieten en widgets", "Volg je favoriete toestel op het beginscherm, in een widget en als Live Activity op het toegangsscherm."),
    ("📺", "Apple TV", "Een groot meldkamerscherm met de kaart en alles wat nu in de lucht is."),
]
feat = "\n".join(f"""      <article class="feature reveal" style="--d:{(i % 4) * .07:.2f}s"><div class="ico">{ic}</div><h3>{t}</h3><p>{d}</p></article>""" for i, (ic, t, d) in enumerate(FEATURES))

ROUTES = """<svg viewBox="0 0 600 545" preserveAspectRatio="none" aria-hidden="true">
  <path id="r1" class="path" stroke="#9333ea" d="M90,420 C170,300 260,260 330,250 S470,170 520,80"/>
  <path id="r2" class="path" stroke="#3f74d8" d="M60,120 C180,150 230,250 300,300 S420,420 540,470"/>
  <path id="r3" class="path" stroke="#0891b2" d="M30,260 C120,230 140,120 230,90 S360,60 420,140 S500,300 580,280"/>
</svg>
<div class="mover" style="offset-path:path('M90,420 C170,300 260,260 330,250 S470,170 520,80');--t:12s"><img src="/assets/img/heli_lifeliner_ec135.webp" alt=""></div>
<div class="mover" style="offset-path:path('M60,120 C180,150 230,250 300,300 S420,420 540,470');--t:15s;--delay:-5s"><img src="/assets/img/heli_politie_ec135.webp" alt=""></div>
<div class="mover" style="offset-path:path('M30,260 C120,230 140,120 230,90 S360,60 420,140 S500,300 580,280');--t:18s;--delay:-9s"><img src="/assets/img/lucht_kustwacht_aw189.webp" alt=""></div>
<span class="spot" style="left:15%;top:77%;--c:#a855f7">Basis</span>
<span class="spot incident" style="left:55%;top:46%">Meerdere heli's op één plek</span>
<span class="spot" style="left:87%;top:15%;--c:#ef4444">Ziekenhuis</span>"""

home = f"""<main>
<section class="hero">
  <div class="flyby" aria-hidden="true"><img src="/assets/img/heli_lifeliner_ec135.webp" alt=""></div>
  <div class="flyby two" aria-hidden="true"><img src="/assets/img/heli_politie_ec135.webp" alt=""></div>
  <div class="wrap">
    <div>
      <span class="pill reveal"><span class="dot"></span><span data-inair>Live</span></span>
      <h1 class="reveal" style="--d:.08s;margin-top:18px">Alles wat vliegt voor de <span class="glow">hulpdiensten</span>. Live.</h1>
      <p class="lead reveal" style="--d:.16s">Lifeliners, politiehelikopters, Kustwacht, Defensie en meer op één kaart. Zie wie er opstijgt, waar ze landen en wat er boven jouw wijk vliegt.</p>
      <div class="hero-actions reveal" style="--d:.24s">
        <a class="btn btn-primary" href="/kaart/">Open de live kaart</a>
        <a class="btn btn-ghost" href="#download" data-appstore><span>Download de app</span></a>
      </div>
      <p class="muted reveal" style="--d:.3s;font-size:.9rem">Voor iPhone, iPad, Mac en Apple TV · <span class="badge-112">112</span></p>
      <div id="weer" class="banner weer" hidden></div>
    </div>
    <div class="radar reveal" style="--d:.15s" role="img" aria-label="Radar met de toestellen die nu in de lucht zijn">
      <span class="pulse"></span><span class="pulse"></span>
      <span class="ring" style="--i:0"></span><span class="ring" style="--i:16%"></span><span class="ring" style="--i:32%"></span>
      <span class="cross"></span><span class="sweep"></span>
      <div id="radarBlips"></div>
    </div>
  </div>
  <a class="scroll-hint" href="#live" aria-label="Naar beneden"><span></span></a>
</section>

<div class="ticker" id="live" aria-label="Nu in de lucht"><div class="ticker-move" id="tickerMove"></div></div>

<section class="block">
  <div class="wrap center">
    <span class="eyebrow reveal">Op dit moment</span>
    <h2 class="reveal">De lucht boven Nederland, nu</h2>
    <div class="stats">
      <div class="stat reveal"><b id="sAir">0</b><span>toestellen in de lucht</span></div>
      <div class="stat reveal" style="--d:.06s"><b id="sHeli">0</b><span>helikopters daarvan</span></div>
      <div class="stat reveal" style="--d:.12s"><b id="sKnown">0</b><span>gezien in 14 dagen</span></div>
      <div class="stat reveal" style="--d:.18s"><b id="sInc">0</b><span>keer meerdere heli's op één plek</span></div>
    </div>
  </div>
</section>

<section class="block" style="padding-top:0">
  <div class="wrap">
    <div class="center">
      <span class="eyebrow reveal">Wat 112Heli doet</span>
      <h2 class="reveal">Weten wat er boven je vliegt</h2>
      <p class="lead reveal">Gemaakt voor iedereen die opkijkt als er een helikopter overkomt.</p>
    </div>
    <div class="features">
{feat}
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap routes">
    <div>
      <span class="eyebrow reveal">Volg elke vlucht</span>
      <h2 class="reveal">Van basis tot landingsplek</h2>
      <p class="lead reveal">Elk toestel laat een spoor achter. Zo zie je waar een Lifeliner vandaan komt, waar hij naartoe gaat en waar hij landt: bij een ziekenhuis, op locatie of terug op de basis.</p>
      <a class="btn btn-primary reveal" href="/kaart/">Bekijk de live kaart</a>
    </div>
    <div class="routemap reveal" style="--d:.1s">{ROUTES}</div>
  </div>
</section>

<section class="block" style="padding-top:0">
  <div class="wrap">
    <div class="center">
      <span class="eyebrow reveal">Alles wat vliegt</span>
      <h2 class="reveal">Zeventien soorten, elk met een eigen tekening</h2>
      <p class="lead reveal">Van Lifeliner tot Chinook en van Kustwacht tot het regeringsvliegtuig. Bij Defensie alleen Nederlandse toestellen.</p>
    </div>
    <div class="gallery" id="gallery"></div>
  </div>
</section>

<section class="block max">
  <div class="wrap">
    <div>
      <span class="eyebrow reveal" style="color:var(--orange)">En voor de lol</span>
      <h2 class="reveal">Volg ook de jet van <span>Max Verstappen</span></h2>
      <p class="lead reveal">PH-UTL, een Falcon 8X. Vliegt hij boven Nederland, dan zie je hem in 112Heli, met een eigen oranje tekening.</p>
      <a class="btn reveal" style="background:var(--orange);color:#fff" href="/toestellen/#verstappen">Over de jet</a>
    </div>
    <img class="jet reveal" src="/assets/img/lucht_verstappen.webp" alt="De jet van Max Verstappen" loading="lazy">
  </div>
</section>

<section class="block download" id="download">
  <div class="wrap">
    <img class="appicon reveal" src="/assets/img/app-icon.png" alt="112Heli app-icoon" width="128" height="128">
    <h2 class="reveal">112Heli in je broekzak</h2>
    <p class="lead reveal" style="margin:0 auto 26px">Gratis. Met pushmeldingen, widgets, Live Activities en een meldkamerscherm op je Apple TV.</p>
    <a class="btn btn-primary reveal" href="#download" data-appstore><span>Binnenkort in de App Store</span></a>
    <div class="platforms reveal"><span>iPhone</span><span>iPad</span><span>Mac</span><span>Apple TV</span></div>
  </div>
</section>
</main>
"""

HOME_DESC = "Zie live waar de Lifeliner, de politiehelikopter (Zulu), de Kustwacht en Defensie vliegen. Gratis app met melding bij opstijgen en landingsplek."
page("/", "Lifeliner en politiehelikopter live op de kaart | 112Heli", HOME_DESC,
     "home", home, "home.js", extra_head=ld(
        {"@type": "WebSite", "@id": SITE + "/#website", "name": "112Heli", "url": SITE + "/", "inLanguage": "nl", "publisher": {"@id": ORG["@id"]}},
        ORG,
        {"@type": "MobileApplication", "name": "112Heli", "operatingSystem": "iOS 17, iPadOS 17, macOS 14, tvOS 17",
         "applicationCategory": "NavigationApplication", "inLanguage": "nl", "description": HOME_DESC, "url": SITE + "/",
         "image": SITE + "/assets/img/app-icon.png", "author": {"@id": ORG["@id"]},
         "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"}}))

# ------------------------------------------------------------------ live map (no footer: full screen)
kaart = """<main class="mapapp">
  <aside>
    <h1 style="font-size:1.5rem;margin-bottom:12px">Live kaart</h1>
    <div class="chips" id="chips" aria-label="Soorten tonen"></div>
    <div id="banners"></div>
    <div id="detail" class="detail" hidden></div>
    <div id="list"><div class="empty">Laden…</div></div>
    <p class="credits" style="text-align:left">Posities: adsb.lol (ODbL). Een icoon met "positie … oud" zendt even niets uit.</p>
  </aside>
  <div id="map" aria-label="Kaart met toestellen"></div>
</main>
"""
page("/kaart/", "Live kaart van alle hulpdiensthelikopters | 112Heli",
     "Live kaart met Apple Kaarten: zie waar de Lifeliner, de politiehelikopter, de Kustwacht en Defensie nu boven Nederland vliegen.",
     "kaart", kaart, "kaart.js", footer=False, og="kaart", extra_head=ld(crumbs("Live kaart", "/kaart/")))

# ------------------------------------------------------------------ aircraft list
toestellen = """<main class="page"><div class="wrap">
  <span class="eyebrow">Toestellen</span>
  <h1>Alle toestellen, live</h1>
  <p class="lead">Elk toestel dat 112Heli de afgelopen twee weken zag, met waar het nu is. <span class="pill"><span class="dot"></span><span data-inair>…</span></span></p>
  <div class="chips" id="filter" style="margin-top:18px" aria-label="Wat wil je zien"></div>
  <div id="live"><div class="empty">Laden…</div></div>
  <h2 id="soorten" style="margin-top:80px">Alles wat vliegt</h2>
  <p class="lead">Wie het zijn en wat ze doen.</p>
  <div class="gallery" id="types"></div>
  <h2 style="margin-top:70px;font-size:1.5rem">Hoe herkent 112Heli een toestel?</h2>
  <p class="muted prose">Elk toestel zendt een vast adres uit dat nooit verandert. Daaraan, aan de registratie en aan het type herkennen we het, ook als de roepnaam per vlucht anders is. Bij Defensie tonen we alleen Nederlandse toestellen. Een toestel dat zijn positie niet uitzendt, staat niet op de kaart.</p>
</div></main>
"""
page("/toestellen/", "Toestellen: Lifeliner, Zulu, Kustwacht | 112Heli",
     "Alle hulpdiensttoestellen live: in de lucht, op de basis of uit beeld. Met uitleg over Lifeliner, Zulu, Kustwacht, Chinook, F-35 en meer.",
     "toestellen", toestellen, "toestellen.js", og="toestellen", extra_head=ld(crumbs("Toestellen", "/toestellen/")))

# ------------------------------------------------------------------ one aircraft
toestel = """<main class="page"><div class="wrap" id="toestel"><div class="empty">Laden…</div></div></main>
"""
page("/toestel/", "Toestel live | 112Heli", "Live positie, route, hoogte, snelheid en vluchten van dit hulpdiensttoestel.", "toestellen", toestel, "toestel.js",
     og="toestellen", robots="noindex, follow")

# ------------------------------------------------------------------ privacy and support
privacy = """<main class="page"><div class="wrap prose">
  <span class="eyebrow">Privacy</span>
  <h1>Privacyverklaring</h1>
  <p class="lead">112Heli verzamelt zo weinig mogelijk. Geen account, geen advertenties, geen tracking.</p>
  <h2>De app</h2>
  <ul>
    <li><b>Pushmeldingen.</b> Zet je meldingen aan, dan bewaren we het pushadres van je toestel en je keuzes (welke soorten, je favorieten, je zones) om je meldingen te kunnen sturen. Zet je ze uit, dan sturen we niets meer.</li>
    <li><b>Locatie.</b> Alleen als je dat toestaat, en afgerond op ongeveer een kilometer, om meldingen uit je eigen omgeving te sturen en de afstand tot een toestel te tonen. We houden geen locatiegeschiedenis bij.</li>
    <li><b>Toestel melden.</b> Stuur je een melding dat een toestel ontbreekt of niet klopt, dan bewaren we je tekst en het toestel, zonder je naam.</li>
    <li><b>Live Activity.</b> Volg je een toestel op het toegangsscherm, dan bewaren we het adres van die Live Activity tot de vlucht voorbij is.</li>
  </ul>
  <h2>De website</h2>
  <p>De website gebruikt geen cookies en geen statistieken. De kaart komt van Apple Kaarten (MapKit JS); Apple verwerkt daarvoor je IP-adres volgens het eigen privacybeleid.</p>
  <h2>De gegevens over toestellen</h2>
  <p>Posities komen van adsb.lol (Open Database License): signalen die toestellen zelf openbaar uitzenden. We tonen alleen hulpdiensten, Defensie (alleen Nederlandse toestellen), Kustwacht, Marechaussee, het regeringsvliegtuig en, voor de lol, de jet van Max Verstappen. Vluchten bewaren we 30 dagen.</p>
  <h2>Vragen</h2>
  <p>Kijk op de <a href="/support/">hulppagina</a> of via <a href="https://lrvdlinden.app">lrvdlinden.app</a>.</p>
  <p class="muted">Laatst bijgewerkt: november 2026.</p>
</div></main>
"""
page("/privacy/", "Privacyverklaring | 112Heli",
     "Welke gegevens 112Heli gebruikt: geen account, geen advertenties en geen tracking. Alleen wat nodig is voor pushmeldingen en je zones.",
     "", privacy, extra_head=ld(crumbs("Privacyverklaring", "/privacy/")))

support = """<main class="page"><div class="wrap prose">
  <span class="eyebrow">Hulp</span>
  <h1>Hulp en veelgestelde vragen</h1>
  <h2>Waarom zie ik een helikopter niet op de kaart?</h2>
  <p>Een toestel staat alleen op de kaart als het zijn positie uitzendt en een ontvanger in de buurt het signaal oppikt. Laag vliegend of bij een inzet zie je een toestel soms even niet. Het icoon wordt dan grijs met "positie … oud".</p>
  <h2>Wat betekent "meerdere helikopters op één plek"?</h2>
  <p>Twee of meer helikopters dicht bij elkaar, op de grond of laag en langzaam, op een plek die geen ziekenhuis of basis is. Vaak is er dan iets groots aan de hand.</p>
  <h2>Hoe krijg ik een melding als er iets boven mijn wijk vliegt?</h2>
  <p>In de app: Instellingen → Mijn zones → Zone toevoegen. Kies je locatie of zoek je wijk of plaats, met een straal van 1 tot 25 km.</p>
  <h2>Waarom krijg ik geen meldingen?</h2>
  <p>Controleer in Instellingen van je iPhone of meldingen voor 112Heli aan staan, en in de app welke soorten en welk gebied je hebt gekozen.</p>
  <h2>Een toestel ontbreekt of klopt niet</h2>
  <p>Gebruik in de app de knop "Dit toestel klopt niet" (bij een toestel) of "Toestel ontbreekt" (in de lijst). Je melding komt direct bij de maker binnen.</p>
  <h2>Contact</h2>
  <p>112Heli is gemaakt door <a href="https://lrvdlinden.app">LRvdLinden</a>.</p>
</div></main>
"""
FAQ = re.findall(r"<h2>(.*?)</h2>\s*<p>(.*?)</p>", support)
page("/support/", "Hulp en veelgestelde vragen | 112Heli",
     "Antwoorden op veelgestelde vragen over 112Heli: waarom een helikopter niet op de kaart staat, meldingen, zones en een toestel melden.",
     "support", support, extra_head=ld(crumbs("Hulp", "/support/"), {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", a)}} for q, a in FAQ if not q.startswith("Contact")]}))

notfound = """<main class="page"><div class="wrap center">
  <img class="appicon" src="/assets/img/app-icon.png" alt="" width="128" height="128">
  <h1>Deze pagina is uit beeld</h1>
  <p class="lead">Net als een helikopter die laag vliegt. Probeer de live kaart.</p>
  <a class="btn btn-primary" href="/kaart/">Naar de live kaart</a>
</div></main>
"""
page("/404.html", "Niet gevonden | 112Heli", "Deze pagina bestaat niet. Bekijk de live kaart met alle hulpdiensthelikopters.", "", notfound, robots="noindex")

# ------------------------------------------------------------------ beheer (same features as LRbeheer → 112Heli)
beheer_page = """<main class="page beheer"><div class="wrap">
  <div id="beheer"><div class="empty">Laden…</div></div>
</div></main>
"""
page("/beheer/", "Beheer | 112Heli", "Beheer van 112Heli: status, toestellen, meldingen en pushberichten.", "", beheer_page, "beheer.js",
     footer=False, robots="noindex, nofollow", extra_head=f'<link rel="stylesheet" href="/assets/css/beheer.css?v={V}">\n')

# ------------------------------------------------------------------ robots.txt and sitemap.xml
open(os.path.join(WEB, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nDisallow: /beheer/\n\nSitemap: {SITE}/sitemap.xml\n")
open(os.path.join(WEB, "sitemap.xml"), "w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + "".join(f"  <url><loc>{SITE}{u}</loc><lastmod>{LASTMOD}</lastmod></url>\n" for u in SITEMAP) + "</urlset>\n")

# ------------------------------------------------------------------ manifest
open(os.path.join(WEB, "site.webmanifest"), "w").write("""{
  "name": "112Heli",
  "short_name": "112Heli",
  "lang": "nl",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0d111c",
  "theme_color": "#0d111c",
  "icons": [
    { "src": "/assets/img/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/img/app-icon.png", "sizes": "512x512", "type": "image/png" }
  ]
}
""")
open(os.path.join(WEB, ".htaccess"), "w").write("""ErrorDocument 404 /404.html
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} off [OR]
  RewriteCond %{HTTP_HOST} ^www\\. [NC]
  RewriteRule ^ https://112heli.lrvdlinden.app%{REQUEST_URI} [L,R=301]
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\\.(webp|png|woff2|ico)$">
    Header set Cache-Control "public, max-age=2592000"
  </FilesMatch>
  <FilesMatch "\\.(css|js)$">
    Header set Cache-Control "public, max-age=86400"
  </FilesMatch>
</IfModule>
""")
print("site built in", WEB)
