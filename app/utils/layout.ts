import type { Diagram } from '~/types/er'

interface LNode { id: string, x: number, y: number, l: number, r: number, t: number, b: number }

const labelWidth = (names: string[]) => Math.max(0, ...names.map(n => n.length * 7 + 44))

/** Computes tidy positions for every node (force-directed, then overlap removal, snapped to the grid). */
export function computeLayout(d: Diagram): Map<string, { x: number, y: number }> {
  const nodes: LNode[] = []
  const index = new Map<string, number>()
  const add = (n: LNode) => { index.set(n.id, nodes.length); nodes.push(n) }

  for (const e of d.entities) {
    const { w, h } = nodeSize(e)
    const comb = e.attributes.length ? 14 + e.attributes.length * 24 : 0
    add({ id: e.id, x: e.x, y: e.y, l: -w / 2, r: Math.max(w / 2, -w / 2 + 18 + labelWidth(e.attributes.map(a => a.name + (a.card === '1,1' ? '' : '(0,N)')))), t: -h / 2, b: h / 2 + comb })
  }
  for (const r of d.relationships) {
    const { w, h } = nodeSize(r)
    const comb = r.attributes.length ? 14 + r.attributes.length * 24 : 0
    add({ id: r.id, x: r.x, y: r.y, l: -w / 2, r: Math.max(w / 2, labelWidth(r.attributes.map(a => a.name + (a.card === '1,1' ? '' : '(0,N)')))), t: -h / 2, b: h / 2 + comb })
  }
  for (const g of d.generalizations) add({ id: g.id, x: g.x, y: g.y, l: -24, r: 24, t: -24, b: 24 })
  const n = nodes.length
  if (!n) return new Map()

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

  // Deterministic start (independent of current positions, so re-running never drifts):
  // walk the graph breadth-first and place nodes on a circle in that order.
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

  // Centre on the origin, then snap.
  const cx1 = nodes.reduce((s, p) => s + p.x, 0) / n
  const cy1 = nodes.reduce((s, p) => s + p.y, 0) / n
  const out = new Map<string, { x: number, y: number }>()
  for (const p of nodes) out.set(p.id, { x: snap(p.x - cx1), y: snap(p.y - cy1) })
  return out
}
