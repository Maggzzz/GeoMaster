# GeoMaster v2 – fase 5 (testversjon)

Denne versjonen bygger videre på fase 4.

## Nytt
- Over/under: befolkning, areal og høyeste punkt, med kategoriutvalg og rekorder per kategori/metrikk.
- Informasjon om høyeste punkt i Utforsk for land der det finnes registrerte data.
- Rekordliste under Statistikk.
- Cacheversjonen i service worker er oppdatert.

## Viktig om datadekning
Høyeste punkt er lagt inn for **121 av 250** oppføringer basert på kuratert foreløpig liste. Andre land og territorier vises som «Ikke registrert» og deltar ikke i fjellhøydespillet. Verdiene er pedagogiske anslag hentet fra vanlige høydepunktslister; topografiske definisjoner, grensespørsmål og målinger kan avvike. Verifiser verdier mot autoritative geografiske kilder før endelig publisering. Ingen høyder blir gjettet når informasjon mangler.

## Test
Bruk Live Server og test alle tre Over/under-metrikker, kategorier (inkl. Annet), riktig/feil, rekke og resultat, omstart, detaljer i Utforsk, og at de eldre spillene fortsatt fungerer.

## Datakilder å bruke ved videre verifisering
- https://en.wikipedia.org/wiki/List_of_elevation_extremes_by_country
- https://aidb.si/d/elevation-extremes-by-country

Behold den publiserte main-branchen uendret under testing.
