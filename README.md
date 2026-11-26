# Chordsmith

App web (PWA) per la composizione: analizza progressioni di accordi, riff e melodie e suggerisce come svilupparli. Funziona nel browser su Mac e Android, offline una volta installata.

## Avvio

```bash
npm install
npm run dev        # http://localhost:5173 (anche dalla rete locale: http://<ip-del-mac>:5173)
npm test           # test del motore teorico
npm run build      # versione di produzione in dist/
```

Per installarla su Android come app: pubblica `dist/` su un hosting HTTPS (Netlify, GitHub Pages, Cloudflare Pages…), aprila in Chrome e scegli «Aggiungi a schermata Home». Per un APK da Play Store si può incapsulare con Capacitor senza toccare il codice.

## Cosa fa

- **Progressioni**: tonalità e modo (anche misolidio/dorico), gradi romani, funzione, accordi presi in prestito, dominanti secondarie, schemi tipici del genere, cadenze; voicing sulla tastiera.
- **Riff/melodie**: tonalità, scale compatibili (pentatoniche, blues, modi), motivi ricorrenti, profilo, estensione; inserimento a testo, in notazione corda:tasto o toccando la tastiera.
- **Suggerimenti**: prossimo accordo, sostituzioni (prestiti modali, relativi, mediante cromatiche, bVII al posto di V…), variazioni (sus2/add9, power chord, pedale, modulazione), nuove sezioni, armonizzazioni del riff e sviluppi del motivo (sequenza, domanda e risposta, pedale, inversione, retrogrado…). Ogni idea si ascolta e si applica, con annulla.

## Architettura

```
src/core/         teoria pura, senza UI (note, scale, accordi, gradi, analisi) — testata
src/genres/       profili di genere (dati): transizioni, prestiti, colori, schemi, consigli
src/instruments/  strumenti: voicing, posizioni, notazione (chitarra e basso)
src/suggest/      provider di suggerimenti: motore a regole + predisposizione AI (llm.ts)
src/audio/        riproduzione con Tone.js (caricato solo al primo play)
src/ui/           componenti React
```

### Estendere

- **Nuovo genere**: crea un `GenreProfile` in `src/genres/` (puoi partire da `genericProfile` con lo spread) e aggiungilo a `GENRES` in `src/genres/index.ts`. Il motore non cambia.
- **Nuovo strumento**: implementa l'interfaccia `Instrument` (`src/instruments/types.ts`) e registralo in `INSTRUMENTS`. Gli strumenti a corde (ukulele, chitarra a 7 corde…) sono solo una nuova istanza di `StringedInstrument`; per un pianoforte serve un'implementazione `kind: 'keyboard'` e un componente tastiera nella UI.
- **AI**: `src/suggest/llm.ts` contiene un provider pronto che manda al modello l'analisi strutturata e rivalida ogni accordo e nota restituiti. Per attivarlo serve un piccolo backend che custodisca la chiave API (mai nel browser) e una riga in `src/suggest/index.ts`.
