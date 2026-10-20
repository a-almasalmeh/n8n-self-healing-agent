import { diffArrays } from 'diff'

export type RowKind = 'equal' | 'changed' | 'removed' | 'added'

export interface DiffLine {
  num: number
  text: string
}

export interface DiffRow {
  kind: RowKind
  left?: DiffLine
  right?: DiffLine
}

/**
 * Vergleicht zwei JSON-Werte zeilenweise und liefert Zeilen für eine
 * Side-by-Side-Ansicht. Gelöschte und hinzugefügte Blöcke, die direkt
 * aufeinander folgen, werden als "changed" nebeneinander gestellt.
 */
export function buildSideBySideDiff(original: unknown, repaired: unknown): DiffRow[] {
  const leftLines = JSON.stringify(original, null, 2).split('\n')
  const rightLines = JSON.stringify(repaired, null, 2).split('\n')
  const chunks = diffArrays(leftLines, rightLines)

  const rows: DiffRow[] = []
  let leftNum = 1
  let rightNum = 1

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]

    if (!chunk.added && !chunk.removed) {
      for (const text of chunk.value) {
        rows.push({ kind: 'equal', left: { num: leftNum++, text }, right: { num: rightNum++, text } })
      }
      continue
    }

    let removed: string[] = []
    let added: string[] = []
    if (chunk.removed) {
      removed = chunk.value
      if (chunks[i + 1]?.added) added = chunks[++i].value
    } else {
      added = chunk.value
    }

    const pairCount = Math.max(removed.length, added.length)
    for (let j = 0; j < pairCount; j++) {
      const hasLeft = j < removed.length
      const hasRight = j < added.length
      rows.push({
        kind: hasLeft && hasRight ? 'changed' : hasLeft ? 'removed' : 'added',
        left: hasLeft ? { num: leftNum++, text: removed[j] } : undefined,
        right: hasRight ? { num: rightNum++, text: added[j] } : undefined,
      })
    }
  }

  return rows
}

export type DisplayItem =
  | { type: 'row'; row: DiffRow }
  | { type: 'fold'; foldId: number; hiddenCount: number }

/**
 * Klappt lange Bereiche identischer Zeilen ein und lässt um jede
 * Änderung `context` Zeilen stehen. Aufgeklappte Bereiche (expanded)
 * werden vollständig angezeigt.
 */
export function collapseEqualRows(rows: DiffRow[], context: number, expanded: Set<number>): DisplayItem[] {
  const items: DisplayItem[] = []
  let i = 0

  while (i < rows.length) {
    if (rows[i].kind !== 'equal') {
      items.push({ type: 'row', row: rows[i++] })
      continue
    }

    const start = i
    while (i < rows.length && rows[i].kind === 'equal') i++
    const end = i

    const keepBefore = start === 0 ? 0 : context
    const keepAfter = end === rows.length ? 0 : context
    const hiddenCount = end - start - keepBefore - keepAfter

    if (hiddenCount <= 1 || expanded.has(start)) {
      for (let k = start; k < end; k++) items.push({ type: 'row', row: rows[k] })
      continue
    }

    for (let k = start; k < start + keepBefore; k++) items.push({ type: 'row', row: rows[k] })
    items.push({ type: 'fold', foldId: start, hiddenCount })
    for (let k = end - keepAfter; k < end; k++) items.push({ type: 'row', row: rows[k] })
  }

  return items
}
