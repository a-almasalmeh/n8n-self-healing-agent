import { useMemo, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { buildSideBySideDiff, collapseEqualRows, type DiffLine, type DiffRow } from './jsonDiff'

const CONTEXT_LINES = 3

const LEFT_BG: Record<DiffRow['kind'], string> = {
  equal: '',
  changed: 'bg-red-500/20',
  removed: 'bg-red-500/20',
  added: 'bg-slate-900',
}

const RIGHT_BG: Record<DiffRow['kind'], string> = {
  equal: '',
  changed: 'bg-emerald-500/20',
  removed: 'bg-slate-900',
  added: 'bg-emerald-500/20',
}

function Cell({ line, bg, marker, className = '' }: { line?: DiffLine; bg: string; marker: string; className?: string }) {
  return (
    <div className={`flex min-w-0 ${bg} ${className}`}>
      <span className="w-10 shrink-0 select-none pr-2 text-right text-slate-500">{line?.num ?? ''}</span>
      <span className="w-4 shrink-0 select-none text-slate-400">{line && marker}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">{line?.text ?? ''}</span>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-slate-600">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
      {label}
    </label>
  )
}

export default function DiffView({ original, repaired }: { original: unknown; repaired: unknown }) {
  const [onlyDiffs, setOnlyDiffs] = useState(false)
  const [expandedFolds, setExpandedFolds] = useState<Set<number>>(new Set())

  const rows = useMemo(() => buildSideBySideDiff(original, repaired), [original, repaired])

  const stats = useMemo(() => {
    let removed = 0
    let added = 0
    for (const row of rows) {
      if (row.kind === 'changed' || row.kind === 'removed') removed++
      if (row.kind === 'changed' || row.kind === 'added') added++
    }
    return { removed, added }
  }, [rows])

  const items = useMemo(
    () => (onlyDiffs ? collapseEqualRows(rows, CONTEXT_LINES, expandedFolds) : rows.map((row) => ({ type: 'row' as const, row }))),
    [rows, onlyDiffs, expandedFolds],
  )

  const hasChanges = stats.added > 0 || stats.removed > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-slate-700">Änderungen der KI</span>
          <span className="font-mono text-red-600">−{stats.removed}</span>
          <span className="font-mono text-emerald-600">+{stats.added}</span>
        </div>
        <Toggle checked={onlyDiffs} onChange={setOnlyDiffs} label="Nur Unterschiede anzeigen" />
      </div>

      <div className="grid grid-cols-2 border-b border-slate-200 text-sm font-semibold">
        <div className="border-r border-slate-200 px-4 py-2 text-red-700">Original-Workflow</div>
        <div className="px-4 py-2 text-emerald-700">Reparierter Workflow</div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-950 py-2 font-mono text-xs leading-relaxed text-slate-100">
        {onlyDiffs && !hasChanges && (
          <div className="px-4 py-6 text-center text-slate-400">Keine Unterschiede – die KI hat den Workflow nicht verändert.</div>
        )}
        {items.map((item, idx) =>
          item.type === 'fold' ? (
            <button
              key={`fold-${item.foldId}`}
              onClick={() => setExpandedFolds((prev) => new Set(prev).add(item.foldId))}
              className="flex w-full items-center justify-center gap-2 border-y border-slate-800 bg-slate-900 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              {item.hiddenCount} identische Zeilen ausgeblendet – klicken zum Anzeigen
            </button>
          ) : (
            <div key={idx} className="grid grid-cols-2">
              <Cell
                line={item.row.left}
                bg={LEFT_BG[item.row.kind]}
                marker={item.row.kind === 'equal' ? '' : '−'}
                className="border-r border-slate-800"
              />
              <Cell line={item.row.right} bg={RIGHT_BG[item.row.kind]} marker={item.row.kind === 'equal' ? '' : '+'} />
            </div>
          ),
        )}
      </div>
    </div>
  )
}
