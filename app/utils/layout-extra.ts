import type { Diagram } from '~/types/er'
import type { LNode, Placed } from './layout-shared'
import { buildLayoutNodes } from './layout-shared'

const GAP = 60

function graph(d: Diagram) {
  const { nodes, index } = buildLayoutNodes(d)
  const adj: number[][] = nodes.map(() => [])
  const connect = (a: string, b: string | null) => {
    const i = index.get(a)
    const j = b ? index.get(b) : undefined
    if (i === undefined || j === undefined || i === j || adj[i]!.includes(j)) return
    adj[i]!.push(j)
    adj[j]!.push(i)
  }
  for (const r of d.relationships) for (const l of r.links) connect(r.id, l.entityId)
  for (const g of d.generalizations) for (const id of [g.parentId, ...g.childIds]) connect(g.id, id)

  // Connected components, each rooted at its best-connected node, with BFS layers.
  const seen = new Set<number>()
  const comps: { ids: number[], layer: Map<number, number> }[] = []
  const roots = [...nodes.keys()].sort((a, b) => adj[b]!.length - adj[a]!.length || Number(nodes[b]!.entity) - Number(nodes[a]!.entity) || a - b)
  for (const root of roots) {
    if (seen.has(root)) continue
    const layer = new Map<number, number>([[root, 0]])
    const ids = [root]
    seen.add(root)
    for (let q = 0; q < ids.length; q++) {
      for (const w of [...adj[ids[q]!]!].sort((a, b) => a - b)) {
        if (seen.has(w)) continue
        seen.add(w)
        layer.set(w, layer.get(ids[q]!)! + 1)
        ids.push(w)
      }
    }
    comps.push({ ids, layer })
  }
  comps.sort((a, b) => b.ids.length - a.ids.length)
  return { nodes, adj, comps }
}

const radiusOf = (n: LNode) => Math.hypot(Math.max(-n.l, n.r), Math.max(-n.t, n.b))
const finish = (nodes: LNode[], pos: Map<number, Placed>) => {
  const xs = [...pos.entries()].flatMap(([i, p]) => [p.x + nodes[i]!.l, p.x + nodes[i]!.r])
  const ys = [...pos.entries()].flatMap(([i, p]) => [p.y + nodes[i]!.t, p.y + nodes[i]!.b])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const out = new Map<string, Placed>()
  for (const [i, p] of pos) out.set(nodes[i]!.id, { x: snap(p.x - cx), y: snap(p.y - cy) })
  return out
}

/** Concentric rings around the best-connected node; each ring holds one step of distance. */
export function computeRadialLayout(d: Diagram): Map<string, Placed> {
  const { nodes, adj, comps } = graph(d)
  if (!nodes.length) return new Map()
  const pos = new Map<number, Placed>()
  let offset = 0
  for (const comp of comps) {
    const depth = Math.max(...comp.ids.map(i => comp.layer.get(i)!)) + 1
    const rings: number[][] = Array.from({ length: depth }, () => [])
    for (const i of comp.ids) rings[comp.layer.get(i)!]!.push(i)
    const angle = new Map<number, number>()
    const local = new Map<number, Placed>()
    let prevR = 0
    let prevHalf = 0
    rings.forEach((ring, k) => {
      const half = Math.max(...ring.map(i => radiusOf(nodes[i]!)))
      if (k === 0) {
        local.set(ring[0]!, { x: 0, y: 0 })
        angle.set(ring[0]!, 0)
        prevHalf = half
        return
      }
      const circumference = ring.reduce((s, i) => s + radiusOf(nodes[i]!) * 2 + GAP, 0)
      const r = Math.max(prevR + prevHalf + half + GAP, circumference / (2 * Math.PI))
      // order by the mean angle of the neighbours on the previous ring
      const want = new Map(ring.map((i) => {
        const ns = adj[i]!.filter(j => comp.layer.get(j) === k - 1)
        const sx = ns.reduce((s, j) => s + Math.cos(angle.get(j)!), 0)
        const sy = ns.reduce((s, j) => s + Math.sin(angle.get(j)!), 0)
        return [i, ns.length ? Math.atan2(sy, sx) : 0]
      }))
      const ordered = [...ring].sort((a, b) => want.get(a)! - want.get(b)!)
      const start = want.get(ordered[0]!)!
      ordered.forEach((i, m) => {
        const a = start + (m / ordered.length) * Math.PI * 2
        angle.set(i, a)
        local.set(i, { x: Math.cos(a) * r, y: Math.sin(a) * r })
      })
      prevR = r
      prevHalf = half
    })
    const xs = [...local.entries()].flatMap(([i, p]) => [p.x + nodes[i]!.l, p.x + nodes[i]!.r])
    const x0 = Math.min(...xs)
    const x1 = Math.max(...xs)
    for (const [i, p] of local) pos.set(i, { x: p.x - x0 + offset, y: p.y })
    offset += x1 - x0 + GAP * 2
  }
  return finish(nodes, pos)
}

/** Every node on one circle, walking the graph so neighbours stay next to each other. */
export function computeCircularLayout(d: Diagram): Map<string, Placed> {
  const { nodes, comps } = graph(d)
  if (!nodes.length) return new Map()
  const order = comps.flatMap(c => c.ids)
  const circumference = order.reduce((s, i) => s + radiusOf(nodes[i]!) * 2 + GAP, 0)
  const r = Math.max(circumference / (2 * Math.PI), 120)
  const pos = new Map<number, Placed>()
  let walked = 0
  for (const i of order) {
    const step = radiusOf(nodes[i]!) * 2 + GAP
    const a = ((walked + step / 2) / circumference) * Math.PI * 2 - Math.PI / 2
    pos.set(i, { x: Math.cos(a) * r, y: Math.sin(a) * r })
    walked += step
  }
  return finish(nodes, pos)
}

/** Even grid in connection order: compact and predictable. */
export function computeGridLayout(d: Diagram): Map<string, Placed> {
  const { nodes, comps } = graph(d)
  if (!nodes.length) return new Map()
  const order = comps.flatMap(c => c.ids)
  const cols = Math.max(1, Math.ceil(Math.sqrt(order.length * 1.6)))
  const cellW = Math.max(...nodes.map(n => n.r - n.l)) + GAP * 1.5
  const cellH = Math.max(...nodes.map(n => n.b - n.t)) + GAP * 1.5
  const pos = new Map<number, Placed>()
  order.forEach((i, k) => {
    const n = nodes[i]!
    pos.set(i, { x: (k % cols) * cellW - (n.l + n.r) / 2, y: Math.floor(k / cols) * cellH - (n.t + n.b) / 2 })
  })
  return finish(nodes, pos)
}
