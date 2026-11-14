# 112Heli – App-informatie (App Store Connect)

## Algemene informatie
| Veld | Waarde |
|---|---|
| Naam | 112Heli |
| Bundle ID | app.lrvdlinden.112HELI |
| SKU | app.lrvdlinden.112HELI |
| Apple ID | TODO: uit App Store Connect |
| Versie / build | 1.0.0 (7) |
| Primaire taal | Dutch (nl-NL) |
| Talen van de app | Alleen Nederlands |
| Platforms | iPhone, iPad, Mac (macOS 14+, eigen Mac-app), Apple TV (tvOS 17+) |
| Prijs | Gratis (geen in-app-aankopen) |
| Primaire categorie | News – actuele inzet van hulpdiensten, zelfde categorie als `LSApplicationCategoryType` in het project |
| Secundaire categorie | Utilities – kaart, meldingen en zones als hulpmiddel |
| Content Rights | Ja, de app toont gegevens van derden: posities van adsb.lol (Open Database License), ziekenhuizen en bases van OpenStreetMap (ODbL), plaatsnamen van PDOK (open data), KNMI-waarschuwingen (open data), weer van Apple WeatherKit (met bronvermelding). Allemaal openbaar en met naamsvermelding in de app. |
| Licentie | Apple Standard EULA |
| Copyright | © 2026 Léon van der Linden |

## Leeftijdsclassificatie (antwoorden)
Alle categorieën "None" (geen geweld, seks, grof taalgebruik, drugs, gokken, horror, medische behandeling). Geen onbeperkte webtoegang, geen chat of gebruikerscontent die anderen zien (een melding "toestel klopt niet" gaat alleen naar de maker). Verwachte uitkomst: 4+.

## App Privacy (privacylabel)
| Gegevenstype | Verzameld | Gekoppeld aan gebruiker | Tracking | Doel |
|---|---|---|---|---|
| Coarse Location (afgerond op ~1 km, en eigen zones) | Ja, alleen met toestemming | Nee | Nee | App Functionality (meldingen uit de buurt) |
| Other User Content (tekst bij "toestel klopt niet") | Ja, alleen als de gebruiker iets meldt | Nee | Nee | App Functionality |

Geen account, geen analytics, geen crash-SDK, geen advertenties, geen tracking (geen ATT). Het pushtoken en de meldingskeuzes worden alleen gebruikt om meldingen te sturen. Dit komt overeen met `PrivacyInfo.xcprivacy` (CoarseLocation, niet gekoppeld, geen tracking; UserDefaults CA92.1).

## Toegankelijkheid (Accessibility Nutrition Labels)
Alleen geclaimd wat in de code staat:
| Functie | iPhone / iPad / Mac | Apple TV |
|---|---|---|
| Dark Interface | Ja (licht, donker of systeem) | Ja |
| Larger Text | Ja (systeemlettertypen, Dynamic Type) | Ja |
| VoiceOver | Ja (labels op kaartmarkers, knoppen en kaart) | Niet geclaimd |
| Differentiate Without Color Alone | Ja (status als tekst, naam bij elk toestel) | Ja |
| Sufficient Contrast | Niet geclaimd (niet gemeten) | Niet geclaimd |
| Reduced Motion | Niet geclaimd | Niet geclaimd |
| Voice Control | Niet geclaimd | Niet geclaimd |
| Captions / Audio Descriptions | Niet van toepassing (geen video) | Niet van toepassing |

## URL's
- Support: https://112heli.lrvdlinden.app/support/
- Marketing: https://112heli.lrvdlinden.app
- Privacy: https://112heli.lrvdlinden.app/privacy/
