# GeoMaster v2 – kvalitetssjekket release candidate

Basert på fase 5 (ingen endringer i eksisterende quizregler eller lagringsnøkler).

## Nytt i denne leveransen
- Service worker bruker ny versjonert cache (`geomaster-v2-rc1`).
- Eksisterende brukere får et valgfritt «Oppdater appen»-varsel når en nyere service worker er klar. Oppdateringen tvinges ikke midt i et spill.
- Nettverksførst for HTML, JavaScript, CSS og landdata; bruker cache som reserve offline. Bilder forblir cache-først.
- Gamle caches ryddes etter aktivering. `localStorage` og lagrede rekorder slettes ikke.

## Manuell kvalitetssjekk før main
1. Åpne i PC-nettleser og på iPhone via HTTPS-publisert testbranch eller GitHub Pages.
2. Kontroller quiz, kart, Utforsk og Over/under (alle tre metrikker).
3. Kontroller tidligere statistikk og rekorder; **ikke slett appdata**.
4. Simuler SW-oppdatering med endret CACHE_NAME ved ny deploy; kontroller at varsel dukker opp og knappen laster ny versjon.
5. Kontroller at vanlig oppstart uten ny deploy **ikke** viser oppdateringsvarsel.
6. Test offline oppstart med internettilgangen av. Kartfliser og eksterne kartgrenser/flaggbilder krever fortsatt internett eller egen cache.

## Datakvalitet
- 250 unike land-/territoriekoder, 197 i kontinentgrupper og 53 i «Annet».
- Høyeste punkt finnes for 121 av 250. Verdiene er foreløpige og ikke gjennomgått mot primærkilder. Ingen manglende høyde blir automatisk fylt med et anslag.
- Kategoriene er laget for quiz og er ikke en juridisk eller folkerettslig klassifisering.

## Publisering
Commit og push til `geomaster-v2` først. Merge til `main` først etter manuell kontroll i nettleser og på telefon. Ved neste utgivelse: oppdater CACHE_NAME for å utløse et nytt kontrollert oppdateringsvarsel.
