# GeoMaster – fase 1 og 2

Dette er en **lokal testversjon**, ikke automatisk publisert på GitHub.

## Endringer
- Felles kategorier for quiz, Utforsk og Finn landet: Alle, Afrika, Asia, Europa, Nord-Amerika, Sør-Amerika, Oseania og Annet.
- Amerika: Mellom-Amerika og Karibia til Nord-Amerika; geografisk Sør-Amerika til Sør-Amerika.
- «Annet» samler territorier og særskilte geografiske områder. Kategorisering er en forenkling for spill, ikke en folkerettslig vurdering. Kosovo, Taiwan og Palestina beholdes i respektive geografiske kategorier. Noen klassifiseringer kan diskuteres.
- Kart via bunnmeny: heldekkende kart uten tekst/knapper over kartet (unntatt Leaflet zoom, attributtering og landkort ved trykk). Bunnmenyen beholdes for navigasjon. På PC er det en diskret tilbakepil.
- Finn landet: større kart med kompakt oppgavevisning og ny kategorivelger.
- Ingen endring i eksisterende lokalt lagret statistikk. Service-worker-cache er versjonert.

## Test lokalt
1. Lag en ny branch fra `main`, f.eks. `geomaster-v2`.
2. Pakk ut ZIP-filen og kopier prosjektfilene inn i prosjektmappen på den nye branchen.
3. Start `index.html` med VS Code Live Server. Test mobilvisning via nettleserens responsive modus.
4. Test Utforsk-kategorier, flaggquiz, hovedstadquiz, kart i utforskingsmodus, kartquiz med regionfilter og at kartpopupen kan lukkes.
5. Ikke slå sammen med `main` før det fungerer på mobil og PC.

Kartgrenser og kartfliser hentes fortsatt eksternt og krever nettverk.
