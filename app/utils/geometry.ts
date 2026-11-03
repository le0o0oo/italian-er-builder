import type { Entity, Relationship } from '~/types/er'

export interface Pt { x: number, y: number }

export const GRID = 12
export const snap = (v: number) => Math.round(v / GRID) * GRID

export const CROW_HEAD = 30
export const CROW_ROW = 22

/** Crow's foot boxes list their attributes inside, so they grow with them. */
function crowSize(n: Entity | Relationship) {
  const ident = n.kind === 'entity' ? (identifyingRows.value[n.id] ?? []) : []
  const hasPk = n.attributes.some(a => a.identifier) || ident.length > 0
  const labels = [...n.attributes.map(a => a.name.length + (a.card === '1,1' ? 0 : 6)), ...ident.map(r => r.length + 2)]
  const rows = Math.max(0, ...labels) * 7.2 + 24 + (hasPk ? 26 : 0)
  const w = Math.max(n.kind === 'entity' ? 120 : 100, n.name.length * (n.kind === 'entity' ? 9.5 : 8.5) + 36, rows)
  const count = n.attributes.length + ident.length
  const h = CROW_HEAD + (count ? count * CROW_ROW + 8 : n.kind === 'entity' ? 12 : 0)
  return { w, h: Math.max(h, n.kind === 'entity' ? 44 : CROW_HEAD) }
}

export function nodeSize(n: Entity | Relationship) {
  if (notation.value === 'crow') return crowSize(n)
  if (n.kind === 'entity') {
    return { w: Math.max(120, n.name.length * 9.5 + 40), h: 48 }
  }
  const w = Math.max(132, n.name.length * 9 + 56)
  return { w, h: Math.max(72, w * 0.52) }
}

/** Point where the ray from the node centre towards `to` leaves the node's outline. */
export function edgePoint(n: Entity | Relationship, to: Pt): Pt {
  const { w, h } = nodeSize(n)
  const dx = to.x - n.x
  const dy = to.y - n.y
  if (!dx && !dy) return { x: n.x, y: n.y }
  const t = n.kind === 'relationship' && notation.value !== 'crow'
    ? 1 / (Math.abs(dx) / (w / 2) + Math.abs(dy) / (h / 2))
    : Math.min((w / 2) / Math.abs(dx), (h / 2) / Math.abs(dy))
  return { x: n.x + dx * t, y: n.y + dy * t }
}
