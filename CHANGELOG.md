# Changelog

## Server (21-11-2026)
- De server haalt alles van A-Alerts alleen nog bij **api.a-alerts.nl**: helikopters, defensie en kustwacht, Max en PH-GOV wereldwijd (`/v1/lucht?bijzonder=1`) en de KNMI-waarschuwingen voor de weerbeperking. De oude A-Alerts-Worker op workers.dev wordt niet meer gevraagd; geeft api.a-alerts.nl niets, dan zoekt de server zelf (adsb.lol en de open netwerken).

## 1.0.0 (4)
- Op de kaart weer de eigen tekeningen in zijaanzicht; het bovenaanzicht is weg.
- Zulu AW139 opnieuw getekend: strak en zonder losse stukken, ook in het app-icoon, het Apple TV-icoon en het splashscreen.

## 1.0.0 (3)
- Eigen server in het Cloudflare-account 112heli: `112heli-api.112heli.workers.dev`.

## 1.0.0 (2)
- Zulu (AW139) helemaal zichtbaar: de tekening viel buiten het kader, ook in het app-icoon.
- Welkomstscherm: je kunt ook de jet van Max Verstappen volgen.

## 1.0.0 (1)
- Live kaart met alles wat vliegt voor de hulpdiensten, met de herkenning en tekeningen van A-Alerts: Lifeliner, Zulu (EC135 en AW139), Kustwacht, Defensie (alleen Nederlandse toestellen), Marechaussee en PH-GOV.
- Voor de lol: de jet van Max Verstappen (PH-UTL).
- Route (1 of 6 uur), hoogte, snelheid, koers, "boven …" en de plek op de grond (ziekenhuis of basis).
- Weer bij het toestel (WeatherKit).
- Pushmeldingen: opstijgen in je gebied, meerdere helikopters op één plek, favorieten.
- Favorieten, widgets (iPhone, iPad, Mac) en Live Activity op het toegangsscherm.
- Historie van 30 dagen.
- Landingsplek: geland bij ziekenhuis, terug op de basis of op locatie (push voor favorieten).
- Eigen zones: een melding als er een toestel boven je wijk of plaats vliegt.
- Melding als een favoriet van roepnaam wisselt.
- Status per toestel (in de lucht, op de basis, op de grond, uit beeld) en de leeftijd van elke positie.
- Weer dat vliegen beperkt (KNMI, via A-Alerts).
- Eigen helikoptergeluid.
- Meld een toestel dat ontbreekt of niet klopt.
- Bundle ID en App Group gelijk aan wat al in het developer-account stond (`app.lrvdlinden.112HELI`).
- Apple TV: meldkamer-kaart met de toestellen in de lucht.
