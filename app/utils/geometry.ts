import type { Entity, Relationship } from '~/types/er'

export interface Pt { x: number, y: number }

export const GRID = 12
export const snap = (v: number) => Math.round(v / GRID) * GRID

export function nodeSize(n: Entity | Relationship) {
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
  const t = n.kind === 'relationship'
    ? 1 / (Math.abs(dx) / (w / 2) + Math.abs(dy) / (h / 2))
    : Math.min((w / 2) / Math.abs(dx), (h / 2) / Math.abs(dy))
  return { x: n.x + dx * t, y: n.y + dy * t }
}
