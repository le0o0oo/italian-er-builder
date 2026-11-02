import type { Diagram } from '~/types/er'
import type { Placed } from './layout-shared'
import { buildLayoutNodes } from './layout-shared'

/**
 * Organic layout: force-directed simulation, then overlap removal. Starts from a deterministic
 * circle (ordered by connection), so re-running never depends on the current positions.
 */
export function computeForceLayout(d: Diagram): Map<string, Placed> {
  const { nodes: boxes, index } = buildLayoutNodes(d)
  const n = boxes.length
  if (!n) return new Map()
  const nodes = boxes.map(b => ({ ...b, x: 0, y: 0 }))

  const edges: [number, number, number][] = []
  for (const r of d.relationships) {
    for (const l of r.links) {
      const a = index.get(r.id)
      const b = index.get(l.entityId)
      if (a !== undefined && b !== undefined) edges.push([a, b, 230])
    }
  }
  for (const g of d.generalizations) {
    const gi = index.get(g.id)!
    for (const id of [g.parentId, ...g.childIds]) {
      const o = id ? index.get(id) : undefined
      if (o !== undefined) edges.push([gi, o, 150])
    }
  }

  // Breadth-first order around a circle keeps connected nodes close at the start.
  const adj: number[][] = nodes.map(() => [])
  for (const [a, b] of edges) { adj[a]!.push(b); adj[b]!.push(a) }
  const order: number[] = []
  const seen = new Set<number>()
  for (let s0 = 0; s0 < n; s0++) {
    if (seen.has(s0)) continue
    const queue = [s0]
    seen.add(s0)
    while (queue.length) {
      const v = queue.shift()!
      order.push(v)
      for (const w of adj[v]!) if (!seen.has(w)) { seen.add(w); queue.push(w) }
    }
  }
  order.forEach((ni, k) => {
    const a = (k / n) * Math.PI * 2
    const rad = 110 * Math.sqrt(n)
    nodes[ni]!.x = Math.cos(a) * rad
    nodes[ni]!.y = Math.sin(a) * rad
  })

  const ITER = 400
  const dx = new Float64Array(n)
  const dy = new Float64Array(n)
  for (let it = 0; it < ITER; it++) {
    dx.fill(0)
    dy.fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let vx = nodes[i]!.x - nodes[j]!.x
        let vy = nodes[i]!.y - nodes[j]!.y
        let dist = Math.hypot(vx, vy)
        if (dist < 1) { vx = Math.sin(i + j); vy = Math.cos(i + j); dist = 1 }
        const f = Math.min(90000 / (dist * dist), 40)
        dx[i]! += vx / dist * f; dy[i]! += vy / dist * f
        dx[j]! -= vx / dist * f; dy[j]! -= vy / dist * f
      }
    }
    for (const [a, b, len] of edges) {
      const vx = nodes[b]!.x - nodes[a]!.x
      const vy = nodes[b]!.y - nodes[a]!.y
      const dist = Math.hypot(vx, vy) || 1
      const f = (dist - len) * 0.06
      dx[a]! += vx / dist * f; dy[a]! += vy / dist * f
      dx[b]! -= vx / dist * f; dy[b]! -= vy / dist * f
    }
    const cap = 40 * (1 - it / ITER) + 1
    for (let i = 0; i < n; i++) {
      const m = Math.hypot(dx[i]!, dy[i]!) || 1
      const s = Math.min(m, cap) / m
      nodes[i]!.x += dx[i]! * s
      nodes[i]!.y += dy[i]! * s
    }
  }

  // Push apart anything whose boxes (attributes included) still overlap.
  const M = 36
  for (let pass = 0; pass < 120; pass++) {
    let moved = false
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i]!
        const b = nodes[j]!
        const ox = Math.min(a.x + a.r, b.x + b.r) - Math.max(a.x + a.l, b.x + b.l) + M
        const oy = Math.min(a.y + a.b, b.y + b.b) - Math.max(a.y + a.t, b.y + b.t) + M
        if (ox <= 0 || oy <= 0) continue
        moved = true
        if (ox < oy) {
          const s = (a.x + (a.l + a.r) / 2 <= b.x + (b.l + b.r) / 2 ? -1 : 1) * ox / 2
          a.x += s; b.x -= s
        }
        else {
          const s = (a.y + (a.t + a.b) / 2 <= b.y + (b.t + b.b) / 2 ? -1 : 1) * oy / 2
          a.y += s; b.y -= s
        }
      }
    }
    if (!moved) break
  }

  const cx = nodes.reduce((s, p) => s + p.x, 0) / n
  const cy = nodes.reduce((s, p) => s + p.y, 0) / n
  const out = new Map<string, Placed>()
  for (const p of nodes) out.set(p.id, { x: snap(p.x - cx), y: snap(p.y - cy) })
  return out
}
