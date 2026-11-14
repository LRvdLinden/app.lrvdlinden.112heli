# 112Heli

Alles wat vliegt voor de hulpdiensten, live: Lifeliners, politiehelikopters (Zulu), Kustwacht, Defensie, Marechaussee en PH-GOV — voor iPhone, iPad, Mac en Apple TV. Bundle ID `app.lrvdlinden.112HELI` (zo staat hij al in je developer-account; Apple ziet hoofdletters niet als verschil), team `EU3UY476T6`, iOS 17 / macOS 14 / tvOS 17. Taal: Nederlands.

De herkenning van toestellen, de tekeningen en de ziekenhuizen/bases komen uit A-Alerts (`LRvdLinden/p2000-apeldoorn`, branch `a-alerts`). A-Alerts zelf is niet aangepast; 112Heli heeft een eigen server.

## Mappen

| Map | Inhoud |
|---|---|
| `Heli112/` | App voor iPhone/iPad en Mac (kaart, toestellen, historie, instellingen) |
| `Heli112Widgets/` | Widgets (In de lucht, Favorieten) en de Live Activity |
| `Heli112TV/` | Apple TV-app (meldkamer-kaart) |
| `Shared/` | Modellen, API, huisstijl, tekeningen (ook in de widgets) |
| `SharedUI/` | Gedeelde schermen app + TV: LiveStore, splash, MoreAppsCard, AppInfoFooter, review-prompt |
| `worker/` | Cloudflare Worker `112heli-api` (D1): ADS-B, pushmeldingen, Live Activity-updates |
| `tools/` | `make_project.py` (maakt `Heli112.xcodeproj`), `make_places.py` (kaartpunten uit A-Alerts) |

## Server (worker/)

- Elke minuut 4× (elke 15 s) adsb.lol voor heel Nederland, zelfde cirkel als A-Alerts. Weigert adsb.lol de Cloudflare-adressen, dan gaat het verzoek via de A-Alerts verkeer-service (`VERKEER_URL` / `VERKEER_TOKEN`).
- Herkenning: `worker/src/aalerts/` (ongewijzigd uit A-Alerts) + `worker/src/fleet.js`.
- Opstijgen/landen, vluchten en posities (30 dagen), "meerdere helikopters op één plek" (A-Alerts-regel: ≥2 heli's binnen 1,5 km, niet bij ziekenhuis of basis).
- Pushmeldingen met dezelfde APNs-sleutel als A-Alerts, topic `app.lrvdlinden.112HELI`; Live Activities via `…push-type.liveactivity`.
- Landingsplek (“geland bij ziekenhuis X”, “terug op de basis”, “geland op locatie”), roepnaam gewijzigd, eigen zones (push als er iets boven je wijk/plaats vliegt, max. 1× per uur per toestel), status per toestel (lucht/basis/grond/uit beeld) en eigen helikoptergeluid `heli.wav` (zelfde als A-Alerts).
- Weer dat vliegen beperkt: KNMI-codes uit de publieke A-Alerts-API (`/v1/waarschuwingen`, alleen lezen), zelfde regel als A-Alerts.
- Meldingen “toestel ontbreekt of klopt niet”: `POST /v1/reports`; in beheer via `GET /v1/beheer/reports` (Basic auth `BEHEER_USER` / `BEHEER_PASSWORD`).
- API: `/health`, `/v1/live`, `/v1/aircraft/:hex/track`, `/v1/flights`, `/v1/flights/:id/track`, `/v1/incidents`, `POST /v1/devices`, `POST /v1/activities`.
- Testen: `cd worker && npm ci && npm test`.

### Deploy (GitHub Actions → workflow "Worker")
Zet deze repository-secrets in `LRvdLinden/app.lrvdlinden.112heli` (waarden uit `app.lrvdlinden.secrets` / A-Alerts):
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `APN_KEY_ID`, `APN_TEAM_ID` (of `TEAM_ID`), `APN_P8_CERT`, en optioneel `VERKEER_URL`, `VERKEER_TOKEN`, `BEHEER_APP_USER` en `BEHEER_APP_PASSWORD` (voor de meldingen in beheer).
De workflow maakt de D1-database `112heli`, deployt `112heli-api` en zet de secrets. Adres: `https://112heli-api.lrvdlinden.workers.dev` (staat in `Config/Base.xcconfig`).

## App bouwen
Open `Heli112.xcodeproj` in Xcode 16 of nieuwer. Schemes: **112Heli** (iPhone/iPad/Mac) en **112Heli TV**.
Capabilities (bij de App ID in het developer-account aanzetten): Push Notifications, App Groups (`group.app.lrvdlinden.112HELI`), WeatherKit.
Vul vóór de App Store-release `HELI_PRIVACY_URL` en `HELI_SUPPORT_URL` in `Config/Base.xcconfig` in.

## Bronnen
Posities: adsb.lol (ODbL). Ziekenhuizen en bases: OpenStreetMap (ODbL). Plaatsen: PDOK (CC0). Weer: Apple Weather.
