import type { Diagram } from '~/types/er'
import type { Placed } from './layout-shared'
import { buildLayoutNodes } from './layout-shared'
import type { Placed as _P } from './layout-shared'

const CROSS_GAP = 56
const MAIN_GAP = 90
const GROUP_GAP = 150

/**
 * Layered layout: nodes are put on layers by distance from the best-connected entity, layers are ordered
 * to reduce crossings and aligned with their neighbours. Both a top-to-bottom and a left-to-right flow
 * are computed and the one with the nicer aspect ratio wins. Deterministic: the result never depends
 * on where the nodes currently are.
 */
export function computeLayeredLayout(d: Diagram): Map<string, Placed> {
  const { nodes, index } = buildLayoutNodes(d)
  const n = nodes.length
  if (!n) return new Map()

  const adj: Set<number>[] = nodes.map(() => new Set())
  const connect = (a: string, b: string | null) => {
    const i = index.get(a)
    const j = b ? index.get(b) : undefined
    if (i === undefined || j === undefined || i === j) return
    adj[i]!.add(j)
    adj[j]!.add(i)
  }
  for (const r of d.relationships) for (const l of r.links) connect(r.id, l.entityId)
  for (const g of d.generalizations) for (const id of [g.parentId, ...g.childIds]) connect(g.id, id)

  // ---- connected components, layered by BFS depth from their best-connected entity ----
  const seen = new Set<number>()
  const comps: { ids: number[], layer: Map<number, number> }[] = []
  const singles: number[] = []
  const byDegree = [...nodes.keys()].sort((a, b) => adj[b]!.size - adj[a]!.size || Number(nodes[b]!.entity) - Number(nodes[a]!.entity) || a - b)
  for (const root of byDegree) {
    if (seen.has(root)) continue
    if (!adj[root]!.size) { singles.push(root); seen.add(root); continue }
    const layer = new Map<number, number>([[root, 0]])
    const ids = [root]
    seen.add(root)
    for (let q = 0; q < ids.length; q++) {
      const v = ids[q]!
      for (const w of [...adj[v]!].sort((a, b) => a - b)) {
        if (seen.has(w)) continue
        seen.add(w)
        layer.set(w, layer.get(v)! + 1)
        ids.push(w)
      }
    }
    comps.push({ ids, layer })
  }
  comps.sort((a, b) => b.ids.length - a.ids.length)
  if (singles.length) comps.push({ ids: singles.sort((a, b) => a - b), layer: new Map(singles.map(i => [i, 0])) })

  function layoutGroup(ids: number[], layerOf: Map<number, number>, horizontal: boolean) {
    const mainExt = (i: number) => horizontal ? [nodes[i]!.l, nodes[i]!.r] as const : [nodes[i]!.t, nodes[i]!.b] as const
    const crossExt = (i: number) => horizontal ? [nodes[i]!.t, nodes[i]!.b] as const : [nodes[i]!.l, nodes[i]!.r] as const
    const depth = Math.max(...ids.map(i => layerOf.get(i)!)) + 1
    const layers: number[][] = Array.from({ length: depth }, () => [])
    for (const i of ids) layers[layerOf.get(i)!]!.push(i)

    // crossing reduction: barycentre sweeps
    const frac = new Map<number, number>()
    const refreshFrac = () => layers.forEach(L => L.forEach((i, k) => frac.set(i, L.length > 1 ? k / (L.length - 1) : 0.5)))
    refreshFrac()
    for (let pass = 0; pass < 6; pass++) {
      const down = pass % 2 === 0
      const order = down ? layers.keys() : [...layers.keys()].reverse()
      for (const li of order) {
        const nb = li + (down ? -1 : 1)
        if (nb < 0 || nb >= depth) continue
        const bc = new Map<number, number>()
        for (const i of layers[li]!) {
          const ns = [...adj[i]!].filter(j => layerOf.get(j) === nb)
          bc.set(i, ns.length ? ns.reduce((s, j) => s + frac.get(j)!, 0) / ns.length : frac.get(i)!)
        }
        layers[li]!.sort((a, b) => bc.get(a)! - bc.get(b)!)
        refreshFrac()
      }
    }

    // cross coordinates: pack, then pull towards neighbours while keeping separation
    const c = new Map<number, number>()
    for (const L of layers) {
      let cursor = 0
      for (const i of L) { c.set(i, cursor - crossExt(i)[0]); cursor = c.get(i)! + crossExt(i)[1] + CROSS_GAP }
      const mid = (Math.min(...L.map(i => c.get(i)! + crossExt(i)[0])) + Math.max(...L.map(i => c.get(i)! + crossExt(i)[1]))) / 2
      for (const i of L) c.set(i, c.get(i)! - mid)
    }
    for (let pass = 0; pass < 8; pass++) {
      const order = pass % 2 === 0 ? [...layers.keys()] : [...layers.keys()].reverse()
      for (const li of order) {
        const L = layers[li]!
        const want = L.map((i) => {
          const ns = [...adj[i]!]
          return ns.length ? ns.reduce((s, j) => s + c.get(j)!, 0) / ns.length : c.get(i)!
        })
        const left = [...want]
        for (let k = 1; k < L.length; k++) left[k] = Math.max(left[k]!, left[k - 1]! + crossExt(L[k - 1]!)[1] + CROSS_GAP - crossExt(L[k]!)[0])
        const right = [...want]
        for (let k = L.length - 2; k >= 0; k--) right[k] = Math.min(right[k]!, right[k + 1]! + crossExt(L[k + 1]!)[0] - CROSS_GAP - crossExt(L[k]!)[1])
        L.forEach((i, k) => c.set(i, (left[k]! + right[k]!) / 2))
      }
    }

    // main coordinates: layer after layer
    const m = new Map<number, number>()
    let cursor = 0
    layers.forEach((L, li) => {
      const lo = Math.min(...L.map(i => mainExt(i)[0]))
      const hi = Math.max(...L.map(i => mainExt(i)[1]))
      const centre = li === 0 ? -lo : cursor - lo
      for (const i of L) m.set(i, centre)
      cursor = centre + hi + MAIN_GAP
    })

    const toXY = (i: number): Placed => horizontal ? { x: m.get(i)!, y: c.get(i)! } : { x: c.get(i)!, y: m.get(i)! }
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity
    const pos = new Map<number, Placed>()
    for (const i of ids) {
      const p = toXY(i)
      pos.set(i, p)
      x0 = Math.min(x0, p.x + nodes[i]!.l); x1 = Math.max(x1, p.x + nodes[i]!.r)
      y0 = Math.min(y0, p.y + nodes[i]!.t); y1 = Math.max(y1, p.y + nodes[i]!.b)
    }
    for (const p of pos.values()) { p.x -= x0; p.y -= y0 }
    return { pos, w: x1 - x0, h: y1 - y0 }
  }

  function run(horizontal: boolean) {
    const all = new Map<number, Placed>()
    let offset = 0
    let w = 0
    let h = 0
    for (const comp of comps) {
      const g = layoutGroup(comp.ids, comp.layer, horizontal)
      for (const [i, p] of g.pos) all.set(i, horizontal ? { x: p.x, y: p.y + offset } : { x: p.x + offset, y: p.y })
      offset += (horizontal ? g.h : g.w) + GROUP_GAP
      w = horizontal ? Math.max(w, g.w) : offset - GROUP_GAP
      h = horizontal ? offset - GROUP_GAP : Math.max(h, g.h)
    }
    return { all, w, h }
  }

  const a = run(false)
  const b = run(true)
  const score = (r: { w: number, h: number }) => Math.abs(Math.log((r.w / r.h) / 1.5))
  const best = score(b) < score(a) - 0.05 ? b : a

  // centre on the origin, then snap
  const cx = best.w / 2
  const cy = best.h / 2
  const out = new Map<string, Placed>()
  for (const [i, p] of best.all) out.set(nodes[i]!.id, { x: snap(p.x - cx), y: snap(p.y - cy) })
  return out
}
