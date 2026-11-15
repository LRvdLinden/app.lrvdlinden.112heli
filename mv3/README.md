# MV3 – live tracker van PH-UTL

Website voor **mv3.lrvdlinden.app**, gemaakt door [PixelForges](https://pixelforges.nl): de Dassault Falcon 8X PH-UTL (ICAO 4867E6) van Max Verstappen live op Apple Kaarten.

- **Live**: positie die tussen twee metingen vloeiend doorschuift, hoogte, snelheid, koers, stijgen/dalen, tijd in de lucht, gevlogen afstand en een hoogteprofiel van de vlucht die nu loopt. Plaatsnamen en vlaggen via Apple.
- **Vluchten (30 dagen)**: kaartjes met de route; elke vlucht is af te spelen (60×, 240× of 900×) met een tijdlijn, vluchtprofiel (hoogte en snelheid) en vluchtgegevens, en te delen via een link (`/#vlucht=<id>`), WhatsApp of X.
- **Cijfers**: vluchten, uren, afstand, langste vlucht, vliegdagen, landen en vaakste bestemmingen.
- **Seizoen**: volgende GP met aftelklok en de afstand van de jet tot het circuit, de laatste uitslag en de kalender met "jet gespot in de raceweek".
- Nederlands en Engels, eenheden (metrisch, luchtvaart, imperiaal), mijn tijd of UTC.

## Gegevens

Alles komt van de 112Heli-server (`worker/` in deze repo): `/v1/live`, `/v1/flights?hex=4867e6`, `/v1/flights/:id/track`, `/v1/f1` en `/v1/mapkit-token`. Pas de server aan in `web/assets/js/config.js`.

Het MapKit-token is gebonden aan het domein. De server moet `https://mv3.lrvdlinden.app` daarom toestaan (`SITE_ORIGINS` of `DEFAULT_ORIGINS` in `worker/src/apple.js`).

## Bouwen en uploaden

De site is ook een PWA (installeerbaar als app, met `sw.js` voor offline gebruik). Bij een nieuwe versie: verhoog `VERSION` in `web/sw.js` en de `?v=` in `index.html`.

Er is geen build-stap: upload de inhoud van `web/` naar de hosting van mv3.lrvdlinden.app. De og-afbeelding maak je opnieuw met `python3 tools/og.py`.

Lettertype: Inter (SIL Open Font License), zie `web/assets/fonts/Inter-OFL.txt`.
