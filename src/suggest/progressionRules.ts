import { chordSymbol, parseChord, transposeChord, type ParsedChord } from '../core/chords'
import { makeKey } from '../core/key'
import { mod12, prettyAccidentals as P } from '../core/notes'
import { analyzeChord, type ProgressionAnalysis } from '../core/progression'
import { degreeOf, parseToken, romanFor, tokenToSymbol } from '../core/roman'
import { MODE_TONIC_QUALITY } from '../core/scales'
import type { GenreProfile } from '../genres/types'
import type { Instrument, Tuning } from '../instruments/types'
import type { Suggestion } from './types'

type Draft = Omit<Suggestion, 'id' | 'source'>

const join = (xs: string[]) => xs.join(' ')
const swapCase = (tok: string) => tok.replace(/[ivIV]+/, (m) => (m === m.toUpperCase() ? m.toLowerCase() : m.toUpperCase()))

function withQuality(chord: ParsedChord, suffixMajor: string, suffixMinor: string): string | null {
  if (chord.quality === 'major') return suffixMajor
  if (chord.quality === 'minor') return suffixMinor
  return null
}

// ---------------------------------------------------------------- next chord

function nextChord(a: ProgressionAnalysis, g: GenreProfile): Draft[] {
  const last = a.items[a.items.length - 1]
  const row = g.transitions[last.token] ?? g.transitions[swapCase(last.token)] ?? {}
  const entries = Object.entries(row).sort((x, y) => y[1] - x[1]).slice(0, 4)
  const max = entries[0]?.[1] ?? 1
  const symbols = a.chords.map((c) => c.symbol)
  return entries.flatMap(([tok, w]) => {
    const sym = tokenToSymbol(tok, a.key)
    const parsed = sym ? parseChord(sym) : null
    if (!sym || !parsed) return []
    const info = analyzeChord(parsed, a.key)
    return [{
      kind: 'prossimo accordo' as const,
      title: `${sym} (${P(info.roman)}) dopo ${last.chord.symbol}`,
      description: info.note,
      chords: [...symbols, sym],
      score: w / max,
    }]
  })
}

// ---------------------------------------------------------------- single-chord substitutions

function substitutions(a: ProgressionAnalysis, g: GenreProfile): Draft[] {
  const w = g.substitutionWeights
  const key = a.key
  const symbols = a.chords.map((c) => c.symbol)
  const out: Draft[] = []
  const replace = (i: number, sym: string, title: string, description: string, score: number) => {
    const chords = [...symbols]
    chords[i] = sym
    out.push({ kind: 'sostituzione', title, description, chords, score })
  }

  a.items.forEach((item, i) => {
    const c = item.chord
    const sym = (rootPc: number, suffix: string) => chordSymbol(rootPc, suffix, key)
    const roman = (s: string) => P(romanFor(parseChord(s)!, key))

    // relative major/minor: shares two notes, softer colour
    if (c.quality === 'major') {
      const s = sym(c.rootPc + 9, 'm')
      replace(i, s, `${c.symbol} → ${s} (relativo minore)`, `${roman(s)} condivide due note con ${c.symbol}: stessa funzione, colore più malinconico.`, w.relative * 0.75)
    } else if (c.quality === 'minor') {
      const s = sym(c.rootPc + 3, '')
      replace(i, s, `${c.symbol} → ${s} (relativo maggiore)`, `${roman(s)} condivide due note con ${c.symbol}: più luminoso, stessa funzione.`, w.relative * 0.7)
    }

    // modal interchange
    if (c.quality === 'major' && [0, 5, 7].includes(item.degree) && i > 0) {
      const s = sym(c.rootPc, 'm')
      const desc = item.degree === 5
        ? 'Il iv minore preso dal modo minore: il colpo di malinconia più usato nel rock.'
        : `Versione minore presa dal modo parallelo: ombra improvvisa su ${c.symbol}.`
      replace(i, s, `${c.symbol} → ${s} (${roman(s)}, prestito)`, desc, w.modalInterchange * (item.degree === 5 ? 1 : 0.7))
    }
    if (item.degree === 7 && c.quality === 'major') {
      const s = sym(c.rootPc + 3, '')
      replace(i, s, `${c.symbol} → ${s} (bVII al posto di V)`, 'Togli la sensibile: la cadenza bVII→I suona più "rock" e meno scolastica della dominante.', w.modalInterchange * 0.95)
    }
    if (item.degree === 9 && c.quality === 'minor') {
      const s = sym(c.rootPc - 1, '')
      replace(i, s, `${c.symbol} → ${s} (bVI)`, 'Il bVI maggiore preso dall\'eolio: più epico e drammatico del vi.', w.modalInterchange * 0.85)
    }
    if (item.degree === 7 && c.quality === 'minor' && MODE_TONIC_QUALITY[key.mode] === 'minor') {
      const s = sym(c.rootPc, '')
      replace(i, s, `${c.symbol} → ${s} (V maggiore)`, 'La dominante maggiore (minore armonica) crea una spinta forte verso la tonica.', 0.55)
    }

    // chromatic mediants on major chords
    if (c.quality === 'major' && i > 0) {
      const s = sym(c.rootPc + 4, '')
      replace(i, s, `${c.symbol} → ${s} (mediante cromatica)`, `Accordo maggiore a una terza maggiore di distanza: tiene una nota in comune e cambia la luce di colpo.`, w.chromaticMediant * 0.6)
    }

    // tritone substitution of dominant sevenths
    if (c.seventh === 'b7' && c.quality === 'major') {
      const s = sym(c.rootPc + 6, '7')
      replace(i, s, `${c.symbol} → ${s} (sostituto di tritono)`, 'Stesso tritono interno, basso che scende cromaticamente: sapore jazz.', w.tritone)
    }
  })

  // applied (secondary) dominants inserted before a diatonic target
  let inserted = 0
  a.items.forEach((item, i) => {
    if (inserted >= 2 || i === 0 || item.degree === 0 || item.category !== 'diatonico') return
    if (item.chord.quality !== 'major' && item.chord.quality !== 'minor') return
    // a "secondary dominant" made only of scale notes is just another diatonic chord
    if (new Set(key.scalePcs).has(mod12(item.chord.rootPc + 11))) return
    const dom = chordSymbol(item.chord.rootPc + 7, w.secondaryDominant > 0.5 ? '7' : '', key)
    const chords = [...symbols.slice(0, i), dom, ...symbols.slice(i)]
    out.push({
      kind: 'sostituzione',
      title: `Inserisci ${dom} prima di ${item.chord.symbol} (V/${P(item.token)})`,
      description: 'Dominante secondaria: crea attesa e "punta" all\'accordo successivo.',
      chords,
      score: w.secondaryDominant * 0.7,
    })
    inserted++
  })

  return out
}

// ---------------------------------------------------------------- whole-progression variations

function variations(a: ProgressionAnalysis, g: GenreProfile): Draft[] {
  const w = g.substitutionWeights
  const key = a.key
  const out: Draft[] = []
  const all = (f: (c: ParsedChord) => string) => a.chords.map(f)

  for (const color of g.colorChords.filter((c) => c.suffix !== '5').slice(0, 3)) {
    const chords = all((c) => {
      const minorSuffix = color.suffix === 'add9' ? 'madd9' : color.suffix === 'maj7' || color.suffix === '7' ? 'm7' : color.suffix
      const suffix = withQuality(c, color.suffix, minorSuffix)
      return suffix === null ? c.symbol : chordSymbol(c.rootPc, suffix, key, c.bassPc)
    })
    if (join(chords) === join(a.chords.map((c) => c.symbol))) continue
    out.push({
      kind: 'variazione',
      title: `Colora con ${color.label}`,
      description: color.suffix.startsWith('sus')
        ? 'Togliere la terza rende gli accordi ambigui e "aperti": suona moderno e lascia spazio alla melodia.'
        : 'Aggiungere una nota di colore arricchisce il suono senza cambiare la funzione degli accordi.',
      chords,
      score: color.weight * w.color,
    })
  }

  if (a.chords.some((c) => c.quality !== 'power')) {
    out.push({
      kind: 'variazione',
      title: 'Versione power chord',
      description: 'Solo fondamentale e quinta: con la distorsione suona pieno e lascia alla melodia la scelta maggiore/minore. Ottima per il ritornello "forte".',
      chords: all((c) => chordSymbol(c.rootPc, '5', key)),
      score: w.power,
    })
  }

  out.push({
    kind: 'variazione',
    title: `Pedale di tonica (${key.tonic} al basso)`,
    description: 'Tieni la tonica fissa al basso (o su una corda a vuoto) mentre gli accordi cambiano sopra: tensione ipnotica.',
    chords: all((c) => (c.rootPc === key.tonicPc ? c.symbol : chordSymbol(c.rootPc, c.suffix, key, key.tonicPc))),
    score: w.pedal * 0.8,
  })

  if (a.chords.length >= 3) {
    out.push({
      kind: 'variazione',
      title: 'Retrogrado (al contrario)',
      description: 'Stessi accordi in ordine inverso: le cadenze cambiano verso, ottimo per un bridge che suoni familiare ma nuovo.',
      chords: [...a.chords].reverse().map((c) => c.symbol),
      score: w.retrograde * 0.6,
    })
  }

  const up = makeKey(key.tonicPc + 2, key.mode)
  out.push({
    kind: 'variazione',
    title: `Modulazione di un tono (in ${up.tonic})`,
    description: 'L\'ultimo ritornello un tono sopra: classico "truck driver change" per dare energia al finale.',
    chords: a.chords.map((c) => transposeChord(c, 2, up)),
    score: w.keyChange * 0.6,
  })

  return out
}

// ---------------------------------------------------------------- new sections from genre templates

function sections(a: ProgressionAnalysis, g: GenreProfile): Draft[] {
  const key = a.key
  const tonicMinor = MODE_TONIC_QUALITY[key.mode] !== 'major'
  const matched = new Set(a.patterns.map((p) => p.template.name))
  const firstDegree = degreeOf(a.chords[0].rootPc, key)
  return g.templates.flatMap((t) => {
    if (matched.has(t.name)) return []
    const first = parseToken(t.romans[0])
    const tonicTok = t.romans.find((r) => parseToken(r)?.degree === 0)
    const templMinor = tonicTok ? parseToken(tonicTok)?.quality === 'minor' : undefined
    let score = 0.5
    if (templMinor !== undefined && templMinor === tonicMinor) score += 0.3
    else if (t.section !== 'bridge') score -= 0.3
    if (first && first.degree !== firstDegree) score += 0.15 // contrast with the current opening
    if (t.section === 'ritornello' || t.section === 'bridge') score += 0.05
    const chords = t.romans.map((r) => tokenToSymbol(r, key)).filter((s): s is string => s !== null)
    return [{
      kind: 'nuova sezione' as const,
      title: `${t.section === 'qualsiasi' ? 'Sezione' : t.section[0].toUpperCase() + t.section.slice(1)}: ${t.name}`,
      description: `${t.romans.map(P).join(' – ')}. ${t.description}`,
      chords,
      score: Math.max(0, Math.min(1, score)),
    }]
  })
}

// ---------------------------------------------------------------- tips

function tips(a: ProgressionAnalysis, g: GenreProfile, instrument: Instrument, tuning: Tuning): Draft[] {
  const out: Draft[] = []
  const hasV = a.items.some((i) => i.degree === 7 && i.chord.quality === 'major')
  if (hasV && g.substitutionWeights.modalInterchange > 0.8)
    out.push({ kind: 'consiglio', title: 'Prova a togliere la dominante', description: 'Nel rock alternativo il V maggiore può suonare "scolastico": prova bVII o IV al suo posto.', score: 0.9 })
  if (a.chords.every((c) => !c.seventh && c.intervals.length <= 3) && g.substitutionWeights.color > 0.7)
    out.push({ kind: 'consiglio', title: 'Accordi tutti "nudi"', description: 'Sono tutte triadi: uno o due accordi sus2/add9 bastano a dare carattere.', score: 0.7 })
  if (instrument.id === 'guitar' && mod12(a.key.tonicPc) === 2 && tuning.id === 'standard')
    out.push({ kind: 'consiglio', title: 'Tonalità di Re: prova il Drop D', description: 'Con la sesta corda in Re hai la tonica a vuoto come pedale e power chord con un dito.', score: 0.85 })
  if (instrument.id === 'guitar' && [4, 9, 2, 7].includes(a.key.tonicPc))
    out.push({ kind: 'consiglio', title: 'Sfrutta le corde a vuoto', description: `In ${a.key.tonic} molte corde a vuoto sono note della scala: lasciale suonare negli accordi per un suono "jangly".`, score: 0.6 })
  const n = a.chords.length
  g.tips.forEach((tip, i) => {
    if ((i + n) % 3 === 0) out.push({ kind: 'consiglio', title: `Idea ${g.name.toLowerCase()}`, description: tip, score: 0.5 })
  })
  return out
}

export function progressionSuggestions(
  a: ProgressionAnalysis,
  g: GenreProfile,
  instrument: Instrument,
  tuning: Tuning,
): Draft[] {
  const subs = substitutions(a, g)
    .sort((x, y) => y.score - x.score)
    .filter((s, i, arr) => arr.findIndex((o) => join(o.chords ?? []) === join(s.chords ?? [])) === i)
    .slice(0, 8)
  return [...nextChord(a, g), ...subs, ...variations(a, g), ...sections(a, g).sort((x, y) => y.score - x.score).slice(0, 5), ...tips(a, g, instrument, tuning)]
}

