# GeoMaster v2 – fase 4 (Kontinentutfordring)

Denne versjonen bygger på fase 3. Åpne lokalt med Live Server på branchen `geomaster-v2`.

## Nytt
- Trykk «Finn landet» på Hjem for spillvalg. Velg verdensdel og «Finn landet» eller «Kontinentutfordring».
- Kontinentutfordringen spør om alle land/steder i valgt kategori som finnes som klikkbare polygoner i kartdatasettet.
- Riktige land forblir grønne. Feiltrykk telles uten å avsløre fasiten.
- Tid, fremgang og feil vises på kartet; resultatskjermen lagrer best-resultat per kategori i `geomaster-continent-records-v1` (først færrest feil, deretter kortest tid).
- Kartet tilpasses automatisk til de tilgjengelige landene i kategorien. «Alle»/«Annet» kan vise hele verden.
- Kartutforsking fra bunnmenyen er uendret. Den gamle enkeltoppgave-quizen er fortsatt tilgjengelig.

## Test
1. Test «Kart» i bunnmenyen – ingen spilloverlegg skal vises.
2. Åpne «Finn landet» fra Hjem, prøv begge spillmoduser.
3. Fullfør en liten kategori, kontroller tid/feil og rekord.
4. Avslutt underveis og sjekk at tidtakeren stopper.
5. Prøv PC/mobil, øvrige quiz og Utforsk.

**Begrensning:** Noen land i den lokale databasen har ikke tilsvarende polygon i GeoJSON-datasettet (særlig små territorier). Antallet spillbare områder vises i spillvalg; listen omfatter bare områder som faktisk kan klikkes på kartet. Kart og landgrenser lastes fortsatt fra eksterne kilder og krever nettforbindelse.
