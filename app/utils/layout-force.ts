import type { Diagram } from '~/types/er'
import type { Placed } from './layout-shared'
import { buildLayoutNodes } from './layout-shared'

/**
 * Organic layout: force-directed simulation, then overlap removal. With `refine`, a local search then untangles
 * crossings, lines through nodes and attribute lists. Starts from a deterministic
 * circle (ordered by connection), so re-running never depends on the current positions.
 */
export function computeForceLayout(d: Diagram, refine = true): Map<string, Placed> {
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

  // ---- keep connection lines clear of other nodes (and of attribute lists) ----
  const SAMPLES = 32
  /** First point of the segment a→b lying inside the rectangle, if any. */
  const firstInside = (ax: number, ay: number, bx: number, by: number, x0: number, y0: number, x1: number, y1: number) => {
    for (let k = 0; k <= SAMPLES; k++) {
      const t = k / SAMPLES
      const x = ax + (bx - ax) * t
      const y = ay + (by - ay) * t
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return t
    }
    return -1
  }
  const PAD = 24

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

  if (refine) {
  // ---- local search: move single nodes to where fewer lines cross nodes, attribute lists or each other ----
  const incident: number[][] = nodes.map(() => [])
  edges.forEach(([a, b], k) => { incident[a]!.push(k); incident[b]!.push(k) })
  const segCross = (p1: number, p2: number, p3: number, p4: number) => {
    const A = nodes[p1]!; const B = nodes[p2]!; const C = nodes[p3]!; const D = nodes[p4]!
    const o = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax))
    return o(A.x, A.y, B.x, B.y, C.x, C.y) !== o(A.x, A.y, B.x, B.y, D.x, D.y)
      && o(C.x, C.y, D.x, D.y, A.x, A.y) !== o(C.x, C.y, D.x, D.y, B.x, B.y)
  }
  const throughBox = (a: number, b: number, k: number) => {
    const K = nodes[k]!
    return firstInside(nodes[a]!.x, nodes[a]!.y, nodes[b]!.x, nodes[b]!.y, K.x + K.l - PAD, K.y + K.t - PAD, K.x + K.r + PAD, K.y + K.b + PAD) >= 0
  }
  /** Lines that must cross the node's attribute list: it hangs on the side with fewer lines, so count the smaller group. */
  const combConflict = (c: number) => {
    const C = nodes[c]!
    const depth = C.b - C.bh
    if (depth <= 0) return 0
    let down = 0
    let up = 0
    for (const o of adj[c]!) {
      const O = nodes[o]!
      if (firstInside(C.x, C.y, O.x, O.y, C.x + C.l, C.y + C.bh, C.x + C.r, C.y + C.bh + depth) >= 0) down++
      if (firstInside(C.x, C.y, O.x, O.y, C.x + C.l, C.y - C.bh - depth, C.x + C.r, C.y - C.bh) >= 0) up++
    }
    return Math.min(down, up)
  }
  /** Every cost term that depends on where node i is. */
  const localCost = (i: number) => {
    const I = nodes[i]!
    let cost = 0
    for (let j = 0; j < n; j++) {
      if (j === i) continue
      const J = nodes[j]!
      const ox = Math.min(I.x + I.r, J.x + J.r) - Math.max(I.x + I.l, J.x + J.l) + M
      const oy = Math.min(I.y + I.b, J.y + J.b) - Math.max(I.y + I.t, J.y + J.t) + M
      if (ox > 0 && oy > 0) cost += 800 + Math.min(ox, oy) * 4
    }
    edges.forEach(([a, b]) => { if (a !== i && b !== i && throughBox(a, b, i)) cost += 1000 })
    for (const k of incident[i]!) {
      const [a, b, rest] = edges[k]!
      for (let c = 0; c < n; c++) if (c !== a && c !== b && throughBox(a, b, c)) cost += 1000
      edges.forEach(([c, d], f) => {
        if (f !== k && c !== a && c !== b && d !== a && d !== b && segCross(a, b, c, d)) cost += 900
      })
      // keep the cardinality label (at the line's middle) away from other labels and from nodes
      const mx = (nodes[a]!.x + nodes[b]!.x) / 2
      const my = (nodes[a]!.y + nodes[b]!.y) / 2
      edges.forEach(([c, d], f) => {
        if (f === k) return
        if (Math.hypot((nodes[c]!.x + nodes[d]!.x) / 2 - mx, (nodes[c]!.y + nodes[d]!.y) / 2 - my) < 46) cost += 600
      })
      for (let c = 0; c < n; c++) {
        const K = nodes[c]!
        if (c !== a && c !== b && mx > K.x + K.l - 20 && mx < K.x + K.r + 20 && my > K.y + K.t - 14 && my < K.y + K.b + 14) cost += 600
      }
      cost += Math.abs(Math.hypot(nodes[a]!.x - nodes[b]!.x, nodes[a]!.y - nodes[b]!.y) - rest) * 0.8
    }
    cost += combConflict(i) * 700
    for (const o of adj[i]!) cost += combConflict(o) * 700
    return cost
  }
  const OFFSETS: [number, number][] = []
  for (const r of [24, 60, 120, 216]) for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) OFFSETS.push([ux * r, uy * r])
  const descend = () => {
    for (let pass = 0; pass < 14; pass++) {
      let improved = false
      for (let i = 0; i < n; i++) {
        const P = nodes[i]!
        const x0 = P.x
        const y0 = P.y
        let best = localCost(i)
        let bx = x0
        let by = y0
        for (const [ox, oy] of OFFSETS) {
          P.x = x0 + ox
          P.y = y0 + oy
          const c = localCost(i)
          if (c < best - 1e-6) { best = c; bx = P.x; by = P.y }
        }
        P.x = bx
        P.y = by
        if (bx !== x0 || by !== y0) improved = true
      }
      // swapping two nodes of the same kind often untangles what single moves cannot
    if (n <= 40) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (nodes[i]!.entity !== nodes[j]!.entity) continue
          const A = nodes[i]!
          const B = nodes[j]!
          const before = localCost(i) + localCost(j)
          ;[A.x, B.x] = [B.x, A.x]
          ;[A.y, B.y] = [B.y, A.y]
          if (localCost(i) + localCost(j) < before - 1e-6) improved = true
          else {
            ;[A.x, B.x] = [B.x, A.x]
            ;[A.y, B.y] = [B.y, A.y]
          }
        }
      }
    }
    if (!improved) break
    }
  }
  const total = () => nodes.reduce((sum, _, i) => sum + localCost(i), 0)
  descend()
  // a few deterministic shake-and-retry rounds to escape local minima (fewer for big diagrams)
  const rounds = n <= 14 ? 12 : n <= 22 ? 7 : n <= 30 ? 3 : n <= 40 ? 1 : 0
  let bestCost = total()
  let bestPos = nodes.map(p => ({ x: p.x, y: p.y }))
  for (let r = 0; r < rounds; r++) {
    nodes.forEach((p, i) => {
      p.x = bestPos[i]!.x + Math.sin((i + 1) * 12.9898 + r * 78.233) * (60 + (r % 4) * 40)
      p.y = bestPos[i]!.y + Math.cos((i + 1) * 39.346 + r * 11.135) * (60 + (r % 4) * 40)
    })
    descend()
    const c = total()
    if (c < bestCost - 1e-6) { bestCost = c; bestPos = nodes.map(p => ({ x: p.x, y: p.y })) }
  }
  nodes.forEach((p, i) => { p.x = bestPos[i]!.x; p.y = bestPos[i]!.y })

  }

  const cx = nodes.reduce((s, p) => s + p.x, 0) / n
  const cy = nodes.reduce((s, p) => s + p.y, 0) / n
  const out = new Map<string, Placed>()
  for (const p of nodes) out.set(p.id, { x: snap(p.x - cx), y: snap(p.y - cy) })
  return out
}
