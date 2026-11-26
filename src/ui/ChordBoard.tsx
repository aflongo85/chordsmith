import { useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { exploreKey, type ExploreChord } from '../core/explore'
import type { KeyContext } from '../core/key'
import { prettyAccidentals as P } from '../core/notes'
import type { ChordAnalysis } from '../core/progression'
import type { GenreProfile } from '../genres/types'
import { soundingChord } from './helpers'

interface Props {
  items: ChordAnalysis[]
  keyCtx: KeyContext
  genre: GenreProfile
  offset: number
  selected: number
  activeChord: number | null
  inRange: (i: number) => boolean
  onPick: (i: number) => void
  onListen: (symbol: string) => void
  onChange: (symbols: string[]) => void
}

const cat = (c: string) => `cat-${c.replace(/\s/g, '-')}`

// prefer the chord under the finger, then the trash, then the strip itself
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  const found = hits.length ? hits : rectIntersection(args)
  const chip = found.filter((h) => String(h.id).startsWith('p:'))
  if (chip.length) return chip
  const trash = found.filter((h) => h.id === 'trash')
  return trash.length ? trash : found
}

function SortableChip({ id, className, title, onClick, onDelete, children }: {
  id: string
  className: string
  title?: string
  onClick: () => void
  onDelete: () => void
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} className="chip-wrap" style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}>
      <button className={className} onClick={onClick} title={title} {...attributes} {...listeners}>
        {children}
      </button>
      <button className="chip-del" onClick={onDelete} aria-label="Elimina accordo" title="Elimina">
        ×
      </button>
    </div>
  )
}

function PaletteChip({ id, chord, onListen, onAdd }: { id: string; chord: ExploreChord; onListen: () => void; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { symbol: chord.symbol } })
  return (
    <div className={`pal-chip ${cat(chord.category)}`} style={{ opacity: isDragging ? 0.35 : 1 }}>
      <button ref={setNodeRef} className="pal-main" onClick={onListen} title={chord.hint || 'Ascolta'} {...attributes} {...listeners}>
        <strong>{P(chord.symbol)}</strong>
        {chord.common && <span className="x-star">★</span>} <small>{P(chord.roman)}</small>
      </button>
      <button className="pal-add" onClick={onAdd} aria-label={`Aggiungi ${chord.symbol} in fondo`}>
        +
      </button>
    </div>
  )
}

function Zone({ id, className, children }: { id: string; className: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? 'over' : ''}`}>
      {children}
    </div>
  )
}

/**
 * The progression as draggable chips (reorder, drop on the trash or × to delete) and,
 * below it, the chords that fit the key: drag one into the progression or tap + to append.
 */
export function ChordBoard(p: Props) {
  const x = useMemo(() => exploreKey(p.keyCtx, p.genre), [p.keyCtx, p.genre])
  const [dragging, setDragging] = useState<{ id: string; symbol: string } | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // long-ish press on touch, so the page still scrolls normally
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const symbols = p.items.map((it) => it.chord.symbol)
  const ids = symbols.map((s, i) => `p:${i}:${s}`)
  const indexOf = (id: string) => ids.indexOf(id)

  const onStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    const symbol = id.startsWith('p:') ? symbols[indexOf(id)] : (e.active.data.current?.symbol as string)
    setDragging({ id, symbol })
  }

  const onEnd = (e: DragEndEvent) => {
    setDragging(null)
    const { active, over } = e
    if (!over) return
    const id = String(active.id)
    const overId = String(over.id)
    const fromStrip = id.startsWith('p:')
    if (fromStrip) {
      const from = indexOf(id)
      if (overId === 'trash') return p.onChange(symbols.filter((_, i) => i !== from))
      if (overId.startsWith('p:')) {
        const to = indexOf(overId)
        if (to !== from) p.onChange(arrayMove(symbols, from, to))
      }
      return
    }
    const symbol = active.data.current?.symbol as string | undefined
    if (!symbol || overId === 'trash') return
    if (overId.startsWith('p:')) {
      // before or after the chord it was dropped on, depending on which half
      const to = indexOf(overId)
      const dragged = active.rect.current.translated
      const after = dragged ? dragged.left + dragged.width / 2 > over.rect.left + over.rect.width / 2 : false
      const at = to + (after ? 1 : 0)
      p.onChange([...symbols.slice(0, at), symbol, ...symbols.slice(at)])
    } else if (overId === 'strip') p.onChange([...symbols, symbol])
  }

  const append = (s: string) => p.onChange([...symbols, s])
  const groups: { title: string; chords: ExploreChord[] }[] = [
    { title: 'In tonalità', chords: x.diatonic.filter((c) => c.chord.quality !== 'dim') },
    { title: 'In prestito', chords: x.borrowed.flatMap((g) => g.chords).sort((a, b) => Number(b.common) - Number(a.common)) },
    { title: 'Dominanti secondarie', chords: x.secondary },
  ]

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setDragging(null)}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <Zone id="strip" className="chord-strip">
          {p.items.map((item, i) => (
            <SortableChip
              key={ids[i]}
              id={ids[i]}
              className={`chord-chip ${cat(item.category)} ${i === p.selected ? 'selected' : ''} ${p.activeChord === i ? 'active' : ''} ${p.inRange(i) ? '' : 'out-of-range'}`}
              title={item.note}
              onClick={() => p.onPick(i)}
              onDelete={() => p.onChange(symbols.filter((_, j) => j !== i))}
            >
              <span className="chord-symbol">{P(item.chord.symbol)}</span>
              <span className="chord-roman">{P(item.roman)}</span>
              <span className="chord-func">{item.func}</span>
              {p.offset !== 0 && <span className="chord-sounding">suona {P(soundingChord(item.chord, p.keyCtx, p.offset))}</span>}
            </SortableChip>
          ))}
          {p.items.length === 0 && <p className="muted small strip-empty">Trascina qui gli accordi qui sotto, o scrivili nel campo in alto.</p>}
        </Zone>
      </SortableContext>

      {dragging?.id.startsWith('p:') ? (
        <Zone id="trash" className="trash">
          🗑 Trascina qui per eliminare
        </Zone>
      ) : (
        <p className="muted small hint">
          Trascina gli accordi per spostarli (sul telefono tieni premuto un attimo), × per eliminarli.
        </p>
      )}

      <div className="palette">
        <div className="palette-head">
          <strong>Accordi che possono stare nella progressione</strong>
          <span className="muted small"> · {p.keyCtx.label} · tocca per ascoltare, trascina nella progressione o + per aggiungere in fondo</span>
        </div>
        {groups.map(
          (g) =>
            g.chords.length > 0 && (
              <div key={g.title} className="palette-row">
                <span className="palette-label muted small">{g.title}</span>
                <div className="palette-chips">
                  {g.chords.map((c) => (
                    <PaletteChip
                      key={`${g.title}-${c.symbol}`}
                      id={`pal:${g.title}:${c.symbol}`}
                      chord={c}
                      onListen={() => p.onListen(c.symbol)}
                      onAdd={() => append(c.symbol)}
                    />
                  ))}
                </div>
              </div>
            ),
        )}
      </div>

      <DragOverlay dropAnimation={null}>{dragging && <div className="drag-ghost">{P(dragging.symbol)}</div>}</DragOverlay>
    </DndContext>
  )
}
