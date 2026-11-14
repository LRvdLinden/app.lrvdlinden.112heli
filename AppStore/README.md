# 112Heli – App Store-pakket 1.0.0 (build 7)

Alles voor App Store Connect. Gemaakt op 14 november 2026.

## Taal van de beelden
Alleen **nl-NL**: de app zelf is alleen Nederlands. App Store Connect toont de Nederlandse beelden ook op de Engelse pagina. De teksten (`metadata/`) staan wel in NL en EN.

## Wat erin zit
| Map | Inhoud |
|---|---|
| `screenshots/nl-NL/iphone-6.3/` | 7 screenshots 1206×2622 |
| `screenshots/nl-NL/iphone-6.1/` | 7 screenshots 1179×2556 |
| `screenshots/nl-NL/ipad-13/` | 5 screenshots 2064×2752 |
| `screenshots/nl-NL/ipad-12.9/` | 5 screenshots 2048×2732 |
| `screenshots/nl-NL/mac/` | 2 screenshots in 2880×1800, 2560×1600, 1440×900 en 1280×800 |
| `screenshots/nl-NL/appletv/` | 2 screenshots in 3840×2160 en 1920×1080 |
| `marketing/nl-NL/` | header 5244×2950 en 3840×1646, zoekresultaten 5244×2950, 3840×2560 en 1920×1280 |
| `metadata/nl-NL`, `metadata/en-US` | naam, ondertitel, promotietekst, beschrijving, trefwoorden, Wat is nieuw, URL's |
| `metadata/privacy/` | privacyverklaring NL/EN en Apple TV-privacytekst |
| `metadata/review_information/` | notities voor App Review (Engels) met NL-kopie, contact |
| `app-info.md` | categorie, leeftijd, privacylabel, toegankelijkheid |

## Let op
- De schermen zijn **nagebouwd in HTML** op basis van de SwiftUI-code (geen simulatoropnames), met neutrale voorbeeldposities. Bronnen: `tools/appstore/template.html` en `build.py`. Echte simulatorschermen kunnen later worden gewisseld.
- Open punten: Apple ID, telefoonnummer en e-mailadres voor App Review vul je zelf in App Store Connect in.

## Uploaden (checklist)
1. App Store Connect → 112Heli → versie 1.0.0: teksten uit `metadata/nl-NL` (Nederlands) en `metadata/en-US` (Engels).
2. Screenshots per apparaat uit `screenshots/nl-NL/…`.
3. Mac- en Apple TV-versie: eigen screenshots uit `mac/` en `appletv/`.
4. App-informatie, privacylabel en leeftijd volgens `app-info.md`.
5. App Review-informatie: `review_information/notes.txt`, geen inlog nodig.
