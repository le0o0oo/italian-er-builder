<script setup lang="ts">
import type { DiagramNode, Entity, Generalization, Relationship } from '~/types/er'

const { diagram, selectedId, mode, pendingId, isEmpty, find, select, addEntity, addRelationship, addGeneralization, connectNodes, addRelationshipBetween, addRelationshipFor, makeChildOf, addAttribute, remove, duplicate, addGeneralizationFor, autoLayout, runLayout } = useDiagram()
const c = useErColors()
const { byNode: warned } = useWarnings()
const { label: key } = useShortcuts()
const { t } = useT()
const ctxNode = shallowRef<DiagramNode | null>(null)
const ctxPoint = ref({ x: 0, y: 0 })

function onContext(ev: MouseEvent, node: DiagramNode | null) {
  ctxNode.value = node
  ctxPoint.value = toWorld(ev)
  if (node) select(node.id)
}
function rename() {
  nextTick(() => setTimeout(() => {
    const el = document.getElementById('name') as HTMLInputElement | null
    el?.focus()
    el?.select()
  }, 50))
}

const svg = ref<SVGSVGElement>()
const content = ref<SVGGElement>()
const view = reactive({ x: 0, y: 0, k: 1 })

type Drag =
  | { type: 'pan', sx: number, sy: number, vx: number, vy: number }
  | { type: 'node', node: DiagramNode, dx: number, dy: number }
  | { type: 'connect' }
let drag: Drag | null = null

function toWorld(ev: { clientX: number, clientY: number }) {
  const r = svg.value!.getBoundingClientRect()
  return { x: (ev.clientX - r.left - view.x) / view.k, y: (ev.clientY - r.top - view.y) / view.k }
}

// ---- touch: pinch to zoom, long-press for the context menu ----
const pointers = new Map<number, { x: number, y: number }>()
let pinch: { dist: number, k: number, wx: number, wy: number } | null = null
let pressTimer: ReturnType<typeof setTimeout> | undefined
let pressStart = { x: 0, y: 0 }
const clearPress = () => { clearTimeout(pressTimer); pressTimer = undefined }
const isCoarse = ref(false)

function trackPointer(ev: PointerEvent) {
  pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
  if (ev.pointerType === 'touch') svg.value?.setPointerCapture(ev.pointerId)
  if (pointers.size === 2) {
    drag = null
    rubber.value = null
    clearPress()
    const [a, b] = [...pointers.values()] as [{ x: number, y: number }, { x: number, y: number }]
    const r = svg.value!.getBoundingClientRect()
    const mx = (a.x + b.x) / 2 - r.left
    const my = (a.y + b.y) / 2 - r.top
    pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: view.k, wx: (mx - view.x) / view.k, wy: (my - view.y) / view.k }
  }
}
function pinchMove() {
  if (!pinch) return
  const [a, b] = [...pointers.values()] as [{ x: number, y: number }, { x: number, y: number }]
  const r = svg.value!.getBoundingClientRect()
  const mx = (a.x + b.x) / 2 - r.left
  const my = (a.y + b.y) / 2 - r.top
  const k = Math.min(3, Math.max(0.2, pinch.k * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist)))
  view.k = k
  view.x = mx - pinch.wx * k
  view.y = my - pinch.wy * k
}

function onBgDown(ev: PointerEvent) {
  if (pointers.size > 1) return
  if (ev.button !== 0 && ev.button !== 1) return
  if (mode.value === 'link') { pendingId.value = null; mode.value = 'select' }
  select(null)
  drag = { type: 'pan', sx: ev.clientX, sy: ev.clientY, vx: view.x, vy: view.y }
  svg.value!.setPointerCapture(ev.pointerId)
}

function onNodeDown(ev: PointerEvent, node: DiagramNode) {
  if (ev.button !== 0 || pointers.size > 1) return
  if (ev.pointerType === 'touch') {
    // long-press opens the context menu (touch screens have no right click)
    const el = ev.currentTarget as Element
    pressStart = { x: ev.clientX, y: ev.clientY }
    clearPress()
    pressTimer = setTimeout(() => {
      drag = null
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: pressStart.x, clientY: pressStart.y }))
    }, 550)
  }
  if (mode.value === 'link') return linkClick(node)
  select(node.id)
  if (autoLayout.value) return
  const p = toWorld(ev)
  drag = { type: 'node', node, dx: node.x - p.x, dy: node.y - p.y }
  svg.value!.setPointerCapture(ev.pointerId)
}

/** Second step of the keyboard/menu "connect" flow: the first node is already chosen. */
function linkClick(node: DiagramNode) {
  const first = find(pendingId.value)
  if (first && connectNodes(first, node)) {
    pendingId.value = null
    mode.value = 'select'
    return
  }
  if (!first) pendingId.value = node.id
}

// ---- drag the handle of the selected node onto another node to connect them ----
const rubber = ref<{ from: DiagramNode, x: number, y: number, target: string | null } | null>(null)

/** world size of one screen pixel for the handle (never smaller than 1, so it stays big when zoomed out) */
const hs = computed(() => Math.max(1, 1 / view.k))

const handle = computed(() => {
  const n = find(selectedId.value)
  if (!n) return null
  const gap = Math.max(22, (isCoarse.value ? 36 : 24) / view.k) // keeps a constant on-screen gap when zoomed out
  const off = n.kind === 'generalization' ? 12 + gap : nodeSize(n).w / 2 + gap
  return { node: n, x: n.x + off, y: n.y }
})

function hitNode(p: { x: number, y: number }, from: DiagramNode): DiagramNode | null {
  const candidates: DiagramNode[] = [...diagram.value.entities, ...diagram.value.relationships, ...diagram.value.generalizations]
  for (const n of candidates) {
    if (n.id === from.id) continue
    const dx = Math.abs(p.x - n.x)
    const dy = Math.abs(p.y - n.y)
    let inside = false
    if (n.kind === 'entity') { const { w, h } = nodeSize(n); inside = dx <= w / 2 + 6 && dy <= h / 2 + 6 }
    else if (n.kind === 'relationship') { const { w, h } = nodeSize(n); inside = dx / (w / 2 + 6) + dy / (h / 2 + 6) <= 1 }
    else inside = Math.hypot(dx, dy) <= 26
    if (!inside) continue
    const ok = from.kind === 'entity' || n.kind === 'entity'
    if (ok) return n
  }
  return null
}

function onHandleDown(ev: PointerEvent) {
  if (ev.button !== 0 || !handle.value || pointers.size > 1) return
  const p = toWorld(ev)
  rubber.value = { from: handle.value.node, x: p.x, y: p.y, target: null }
  drag = { type: 'connect' }
  svg.value!.setPointerCapture(ev.pointerId)
}

function onMove(ev: PointerEvent) {
  if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
  if (pinch) return pinchMove()
  if (pressTimer && Math.hypot(ev.clientX - pressStart.x, ev.clientY - pressStart.y) > 8) clearPress()
  if (!drag) return
  if (drag.type === 'connect') {
    const p = toWorld(ev)
    const r = rubber.value!
    r.x = p.x
    r.y = p.y
    r.target = hitNode(p, r.from)?.id ?? null
    return
  }
  if (drag.type === 'pan') {
    view.x = drag.vx + ev.clientX - drag.sx
    view.y = drag.vy + ev.clientY - drag.sy
  }
  else {
    const p = toWorld(ev)
    drag.node.x = snap(p.x + drag.dx)
    drag.node.y = snap(p.y + drag.dy)
  }
}
/** Entity dropped on another entity: ask which kind of connection to create. */
const choice = ref<{ a: Entity, b: Entity, left: number, top: number } | null>(null)
const choiceOpen = computed({ get: () => !!choice.value, set: (v) => { if (!v) choice.value = null } })

function onUp(ev?: PointerEvent) {
  if (ev) pointers.delete(ev.pointerId)
  if (pointers.size < 2) pinch = null
  clearPress()
  if (drag?.type === 'connect' && rubber.value) {
    const from = rubber.value.from
    const target = find(rubber.value.target)
    if (target?.kind === 'entity' && from.kind === 'entity' && ev) {
      const r = svg.value!.getBoundingClientRect()
      choice.value = { a: from, b: target, left: ev.clientX - r.left, top: ev.clientY - r.top }
    }
    else if (target) connectNodes(from, target)
    rubber.value = null
  }
  drag = null
}

// Trackpads send many small, often fractional deltas (and deltaX); mouse wheels send big steps on Y only.
let lastWheel = 0
let trackpad = false
function looksLikeTrackpad(ev: WheelEvent) {
  if (ev.deltaMode !== 0) return false
  const now = ev.timeStamp
  if (ev.deltaX !== 0 || !Number.isInteger(ev.deltaY) || Math.abs(ev.deltaY) < 50) trackpad = true
  else if (now - lastWheel > 300) trackpad = false // isolated big integer step: a wheel notch
  lastWheel = now
  return trackpad
}

function onWheel(ev: WheelEvent) {
  // two-finger scroll pans; pinch (reported as ctrl+wheel) and mouse wheel zoom
  if (!ev.ctrlKey && looksLikeTrackpad(ev)) {
    view.x -= ev.deltaX
    view.y -= ev.deltaY
    return
  }
  const r = svg.value!.getBoundingClientRect()
  const mx = ev.clientX - r.left
  const my = ev.clientY - r.top
  const k = Math.min(3, Math.max(0.2, view.k * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015))))
  view.x = mx - (mx - view.x) * (k / view.k)
  view.y = my - (my - view.y) * (k / view.k)
  view.k = k
}

function onBgDblClick(ev: MouseEvent) {
  if (mode.value !== 'select') return
  const p = toWorld(ev)
  addEntity(p.x, p.y)
}

// ---- attribute lists hang on the side (below/above) that the connection lines avoid ----
const combDirs = computed(() => {
  const d = diagram.value
  const adj = new Map<string, { x: number, y: number }[]>()
  const link = (a: { id: string, x: number, y: number }, b: { id: string, x: number, y: number }) => {
    adj.set(a.id, [...(adj.get(a.id) ?? []), { x: b.x, y: b.y }])
    adj.set(b.id, [...(adj.get(b.id) ?? []), { x: a.x, y: a.y }])
  }
  const ent = (id: string | null) => d.entities.find(e => e.id === id)
  for (const r of d.relationships) for (const l of r.links) { const e = ent(l.entityId); if (e) link(r, e) }
  for (const g of d.generalizations) for (const id of [g.parentId, ...g.childIds]) { const e = ent(id); if (e) link(g, e) }

  const out: Record<string, 1 | -1> = {}
  for (const n of [...d.entities, ...d.relationships]) {
    out[n.id] = 1
    if (!n.attributes.length) continue
    const { w, h } = nodeSize(n)
    const spine = n.kind === 'entity' ? -w / 2 + 18 : 0
    const labelW = Math.max(...n.attributes.map(a => a.name.length + (a.card === '1,1' ? 0 : 6))) * 7 + 44
    const x0 = n.x + spine - 6
    const x1 = n.x + spine + labelW
    const depth = 14 + n.attributes.length * 24
    const hits = (dir: 1 | -1) => {
      const y0 = dir === 1 ? n.y + h / 2 : n.y - h / 2 - depth
      const y1 = dir === 1 ? n.y + h / 2 + depth : n.y - h / 2
      let count = 0
      for (const q of adj.get(n.id) ?? []) {
        for (let t = 0; t <= 1; t += 0.02) {
          const px = n.x + (q.x - n.x) * t
          const py = n.y + (q.y - n.y) * t
          if (px >= x0 && px <= x1 && py >= y0 && py <= y1) count++
        }
      }
      return count
    }
    out[n.id] = hits(-1) < hits(1) ? -1 : 1
  }
  return out
})
const combDir = (id: string) => combDirs.value[id] ?? 1

// ---- geometry for links & generalizations ----
const lines = computed(() => {
  const out: { entityId: string, id: string, x1: number, y1: number, x2: number, y2: number, lx: number, ly: number, card: string, identifying: boolean }[] = []
  for (const rel of diagram.value.relationships) {
    for (const [i, link] of rel.links.entries()) {
      const ent = diagram.value.entities.find(e => e.id === link.entityId)
      if (!ent) continue
      const siblings = rel.links.filter(l => l.entityId === link.entityId)
      const idx = siblings.indexOf(link)
      const off = (idx - (siblings.length - 1) / 2) * 32
      const len = Math.hypot(rel.x - ent.x, rel.y - ent.y) || 1
      const ux = (rel.x - ent.x) / len
      const uy = (rel.y - ent.y) / len
      const e = edgePoint(ent, rel)
      const p = { x: e.x - uy * off, y: e.y + ux * off }
      const q = edgePoint(rel, ent)
      out.push({
        entityId: ent.id, id: `${rel.id}-${link.id}-${i}`, x1: q.x, y1: q.y, x2: p.x, y2: p.y,
        lx: (p.x + q.x) / 2, ly: (p.y + q.y) / 2,
        card: `(${link.card})`, identifying: link.identifying,
      })
    }
  }
  return out
})

type P = { x: number, y: number }
const keyIndexes = (ent: Entity) => ent.attributes.flatMap((a, i) => (a.identifier ? [i] : []))
const identifyingLines = (ent: Entity) => lines.value.filter(l => l.entityId === ent.id && l.identifying)
/** Key attribute(s) that are part of a composite identifier: their circles stay empty and a line crosses them. */
const attrKeyIsComposite = (ent: Entity) => keyIndexes(ent).length > 0 && keyIndexes(ent).length + identifyingLines(ent).length >= 2

/**
 * Composite identifiers (several key attributes and/or identifying relationships) are drawn as one rectilinear line
 * that crosses every member and ends in a filled dot. A single key attribute is just a filled circle.
 * Around the box the line either goes the long way round (away from the attribute list) or hugs the list side;
 * whichever crosses fewer unrelated connectors wins, then fewer branches, then the shortest line.
 */
const keyCrosses = computed(() => {
  const M = 14
  const out: { id: string, d: string, dot: P }[] = []
  const path = (pts: P[]) => pts.map((q, k) => `${k ? 'L' : 'M'}${q.x} ${q.y}`).join(' ')
  for (const ent of diagram.value.entities) {
    const keyIdx = keyIndexes(ent)
    const ids = identifyingLines(ent)
    if (keyIdx.length + ids.length < 2) continue
    const { w, h } = nodeSize(ent)
    const dir = combDir(ent.id)
    const yAt = (i: number) => ent.y + dir * (h / 2 + 12 + i * 24)
    const kx = ent.x - w / 2 + 18 + 11
    const first = keyIdx[0]
    const last = keyIdx[keyIdx.length - 1]

    // only key attributes: a line down through their stems
    if (!ids.length) {
      const dot = { x: kx, y: yAt(first!) - dir * 8 }
      out.push({ id: ent.id, dot, d: path([dot, { x: kx, y: yAt(last!) + dir * 8 }]) })
      continue
    }

    const mine = lines.value.filter(l => l.entityId === ent.id)
    const others = mine.filter(o => !o.identifying)
    const R = { l: ent.x - w / 2 - M, r: ent.x + w / 2 + M, t: ent.y - h / 2 - M, b: ent.y + h / 2 + M }
    // hugging track: just under the attribute list side of the box (a normal margin when there is no list)
    const tight = ent.attributes.length > 0
    const Rh = { ...R, b: dir === 1 && tight ? ent.y + h / 2 + 4 : R.b, t: dir === -1 && tight ? ent.y - h / 2 - 4 : R.t }

    // a walk around a rectangle, starting from its comb-side left corner
    const makeWalk = (r: typeof R, step: number) => {
      const corners: P[] = [{ x: r.l, y: r.b }, { x: r.l, y: r.t }, { x: r.r, y: r.t }, { x: r.r, y: r.b }] // BL TL TR BR
      const s0 = dir === 1 ? 0 : 1
      const poly = [0, 1, 2, 3, 4].map(k => corners[(s0 + k * step) % 4]!)
      const segs = poly.slice(0, 4).map((p, k) => ({ p, q: poly[k + 1]!, len: Math.hypot(poly[k + 1]!.x - p.x, poly[k + 1]!.y - p.y) }))
      const total = segs.reduce((n, sg) => n + sg.len, 0)
      // distance along the walk at which a connector leaves the rectangle
      const hit = (l: { x1: number, y1: number, x2: number, y2: number }) => {
        const len = Math.hypot(l.x1 - l.x2, l.y1 - l.y2) || 1
        const ux = (l.x1 - l.x2) / len
        const uy = (l.y1 - l.y2) / len
        const sx = ux > 0 ? (r.r - l.x2) / ux : ux < 0 ? (r.l - l.x2) / ux : Infinity
        const sy = uy > 0 ? (r.b - l.y2) / uy : uy < 0 ? (r.t - l.y2) / uy : Infinity
        const e = Math.min(sx, sy)
        const X = { x: l.x2 + ux * e, y: l.y2 + uy * e }
        let acc = 0
        for (const sg of segs) {
          const near = Math.abs((X.x - sg.p.x) * (sg.q.y - sg.p.y) - (X.y - sg.p.y) * (sg.q.x - sg.p.x)) < 0.5 * sg.len
            && X.x >= Math.min(sg.p.x, sg.q.x) - 0.5 && X.x <= Math.max(sg.p.x, sg.q.x) + 0.5
            && X.y >= Math.min(sg.p.y, sg.q.y) - 0.5 && X.y <= Math.max(sg.p.y, sg.q.y) + 0.5
          if (near) return acc + Math.hypot(X.x - sg.p.x, X.y - sg.p.y)
          acc += sg.len
        }
        return Infinity
      }
      const pointAt = (dist: number): P => {
        let acc = 0
        for (const sg of segs) {
          if (dist <= acc + sg.len) {
            const f = (dist - acc) / sg.len
            return { x: sg.p.x + (sg.q.x - sg.p.x) * f, y: sg.p.y + (sg.q.y - sg.p.y) * f }
          }
          acc += sg.len
        }
        return poly[4]!
      }
      /** the stretch of the walk between two distances, corners included */
      const between = (d0: number, d1: number) => {
        const pts: P[] = [pointAt(Math.max(0, d0))]
        let acc = 0
        for (const sg of segs) {
          acc += sg.len
          if (acc > d0 && acc < d1) pts.push(sg.q)
        }
        pts.push(pointAt(Math.min(total, d1)))
        return pts
      }
      /** a stretch of the closed loop starting at distance `from`, `length` long, wrapping past the start corner if needed */
      const arc = (from: number, length: number) => {
        const start = ((from % total) + total) % total
        const pts: P[] = [pointAt(start)]
        let acc = 0
        for (let lap = 0; lap < 2; lap++) {
          for (const sg of segs) {
            acc += sg.len
            if (acc > start && acc < start + length) pts.push(sg.q)
          }
        }
        pts.push(pointAt((start + length) % total))
        return pts
      }
      return { hit, between, arc, total }
    }
    const around = makeWalk(R, dir === 1 ? 1 : 3)
    const hug = makeWalk(Rh, dir === 1 ? 3 : 1)

    // identifying relationships only: one line crossing them all, dot at its start.
    // Try every stretch of the closed loop that covers them all and keep the one crossing the fewest other connectors.
    if (!keyIdx.length) {
      const loop = makeWalk(Rh, dir === 1 ? 1 : 3)
      const at = ids.map(l => loop.hit(l)).sort((x, y) => x - y)
      if (at.some(x => !isFinite(x))) continue
      const cands = at.map((_, i) => {
        // leave out the gap that ends at at[i]: the line starts at at[i] and runs forward to the point before it
        const from = at[i]! - 12
        const length = (((at[(i + at.length - 1) % at.length]! - at[i]!) % loop.total) + loop.total) % loop.total + 24
        const len = at.length === 1 ? 24 : length
        const crossed = others.filter(o => (((loop.hit(o) - from) % loop.total) + loop.total) % loop.total < len).length
        return { from, len, score: crossed * 100000 + len }
      }).sort((x, y) => x.score - y.score)
      const best = cands[0]!
      const pts = loop.arc(best.from, best.len)
      out.push({ id: ent.id, dot: pts[0]!, d: path(pts) })
      continue
    }

    // key attribute(s) + identifying relationship(s)
    const dot = { x: kx, y: yAt(first!) - dir * 8 }
    const exitY = yAt(last!) + dir * 12
    const stem: P[] = [dot, { x: kx, y: exitY }, { x: R.l, y: exitY }]
    const ats = ids.map(l => ({ a: around.hit(l), h: hug.hit(l) }))
    const plan = (pick: (i: number) => 'around' | 'hug' | null) => {
      const reach = { around: 0, hug: 0 }
      ids.forEach((_, i) => {
        const k = pick(i)
        if (!k) return
        reach[k] = Math.max(reach[k], k === 'around' ? ats[i]!.a : ats[i]!.h)
      })
      if (!isFinite(reach.around + reach.hug) || !(reach.around || reach.hug)) return null
      const crossed = others.filter(o => (reach.around && around.hit(o) < reach.around + 12) || (reach.hug && hug.hit(o) < reach.hug + 12)).length
      const branches = (reach.around ? 1 : 0) + (reach.hug ? 1 : 0)
      return { reach, score: crossed * 100000 + branches * 2000 + reach.around + reach.hug }
    }
    const split = plan((i) => {
      const at = ats[i]!
      const cross = (walk: typeof around, d: number) => others.filter(o => walk.hit(o) < d + 12).length
      const ca = cross(around, at.a)
      const ch = cross(hug, at.h)
      return ch < ca || (ch === ca && at.h < at.a) ? 'hug' : 'around'
    })
    const best = [plan(() => 'around'), plan(() => 'hug'), split].filter(x => x !== null).sort((x, y) => x!.score - y!.score)[0]
    if (!best) continue
    const reach = best.reach
    // Hugging only: the dot goes below the last key stem so the line climbs through it onto the track.
    const mark = reach.around ? dot : { x: kx, y: yAt(last!) + dir * 9 }
    const parts: string[] = []
    if (reach.around) parts.push(path([...stem, ...around.between(0, reach.around + 12)]))
    if (reach.hug) {
      const track = dir === 1 ? Rh.b : Rh.t
      parts.push(path([mark, { x: kx, y: track }, ...hug.between(0, reach.hug + 12).slice(1)]))
    }
    if (parts.length) out.push({ id: ent.id, dot: mark, d: parts.join(' ') })
  }
  return out
})

const gens = computed(() => diagram.value.generalizations.map((g) => {
  const parent = diagram.value.entities.find(e => e.id === g.parentId)
  const angle = parent ? Math.atan2(parent.y - g.y, parent.x - g.x) : -Math.PI / 2
  // The arrow sits on the parent's border (pointing at it); the node itself is the junction of the child lines.
  const edge = parent ? edgePoint(parent, g) : null
  const ARROW = 26
  const base = edge ? { x: edge.x - Math.cos(angle) * ARROW, y: edge.y - Math.sin(angle) * ARROW } : null
  // Dashed hints for the missing half of an unfinished generalization.
  const stubs: { label: string, x1: number, y1: number, x2: number, y2: number, lx: number, ly: number }[] = []
  const stub = (label: string, dir: number, startOffset: number) => {
    const cos = Math.cos(dir)
    const sin = Math.sin(dir)
    stubs.push({
      label,
      x1: g.x + cos * startOffset, y1: g.y + sin * startOffset,
      x2: g.x + cos * (startOffset + 48), y2: g.y + sin * (startOffset + 48),
      lx: g.x + cos * (startOffset + 48 + 14), ly: g.y + sin * (startOffset + 48 + 14),
    })
  }
  if (!parent) stub(t('canvas.noParent'), angle, 10)
  if (!g.childIds.some(id => diagram.value.entities.some(e => e.id === id))) stub(t('canvas.noChildren'), angle + Math.PI, 10)
  const lx = g.x - Math.sin(angle) * 20
  const ly = g.y + Math.cos(angle) * 20
  const notation = `(${g.total ? 't' : 'p'},${g.exclusive === false ? 's' : 'e'})`
  return {
    g, stubs, notation, lx, ly, angle: angle * 180 / Math.PI,
    parentLine: base ? { from: { x: g.x, y: g.y }, to: base } : null,
    arrow: edge ? { x: edge.x, y: edge.y } : null,
    childLines: g.childIds.flatMap((id) => {
      const c = diagram.value.entities.find(e => e.id === id)
      return c ? [{ id, from: { x: g.x, y: g.y }, to: edgePoint(c, g) }] : []
    }),
  }
}))

const isSel = (n: { id: string }) => selectedId.value === n.id
const isPending = (n: { id: string }) => pendingId.value === n.id
const outline = (n: Entity | Relationship) => {
  const { w, h } = nodeSize(n)
  return n.kind === 'entity'
    ? { points: '', x: -w / 2 - 5, y: -h / 2 - 5, w: w + 10, h: h + 10 }
    : { points: `0,${-h / 2 - 6} ${w / 2 + 6},0 0,${h / 2 + 6} ${-w / 2 - 6},0`, x: 0, y: 0, w: 0, h: 0 }
}
const diamond = (n: Relationship) => {
  const { w, h } = nodeSize(n)
  return `0,${-h / 2} ${w / 2},0 0,${h / 2} ${-w / 2},0`
}

// ---- view helpers & export ----
function center() {
  const r = svg.value!.getBoundingClientRect()
  return toWorld({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })
}

function fit() {
  const g = content.value
  const s = svg.value
  if (!g || !s) return
  const bb = g.getBBox()
  const r = s.getBoundingClientRect()
  if (!bb.width || !bb.height) { Object.assign(view, { x: r.width / 2, y: r.height / 2, k: 1 }); return }
  const k = Math.min(1.2, (r.width - 120) / bb.width, (r.height - 120) / bb.height)
  view.k = k
  view.x = r.width / 2 - (bb.x + bb.width / 2) * k
  view.y = r.height / 2 - (bb.y + bb.height / 2) * k
}

function zoom(f: number) {
  const r = svg.value!.getBoundingClientRect()
  onWheel({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, deltaY: -Math.log(f) / 0.0015 } as WheelEvent)
}

/** Standalone SVG markup of the diagram, on a white background. */
function exportSvg(opts: { skipUnconnected?: boolean } = {}) {
  const g = content.value!
  const skip = opts.skipUnconnected ? [...isolatedEntityIds(diagram.value)] : []
  const hidden = skip.flatMap(id => [...g.querySelectorAll<SVGElement>(`[data-id="${id}"]`)])
  hidden.forEach(n => (n.style.display = 'none')) // getBBox ignores hidden nodes
  const bb = g.getBBox()
  const clone = g.cloneNode(true) as SVGGElement
  hidden.forEach(n => (n.style.display = ''))
  clone.querySelectorAll('[data-id]').forEach((n) => {
    if (skip.includes(n.getAttribute('data-id')!)) n.remove()
  })
  clone.removeAttribute('transform')
  clone.querySelectorAll('[data-ui]').forEach(n => n.remove())
  const pad = 32
  const x = bb.x - pad
  const y = bb.y - pad
  const w = bb.width + pad * 2
  const h = bb.height + pad * 2
  let inner = new XMLSerializer().serializeToString(clone)
  for (const k of ['ink', 'paper', 'muted'] as const) inner = inner.replaceAll(ER_DARK[k], ER_LIGHT[k])
  return {
    width: w,
    height: h,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" font-family="Arial, Helvetica, sans-serif"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>${inner}</svg>`,
  }
}

function focusNode(id: string) {
  const n = find(id)
  const r = svg.value?.getBoundingClientRect()
  if (!n || !r) return
  view.x = r.width / 2 - n.x * view.k
  view.y = r.height / 2 - n.y * view.k
}

/** Pan so the selected node isn't hidden behind the inspector card. */
function revealSelected() {
  const id = selectedId.value
  const s = svg.value
  const card = document.querySelector<HTMLElement>('[data-inspector]')
  if (!id || !s || !card) return
  const node = s.querySelector<SVGGraphicsElement>(`[data-id="${CSS.escape(id)}"]`)
  if (!node) return
  const n = node.getBoundingClientRect()
  const v = s.getBoundingClientRect()
  let c = card.getBoundingClientRect()
  if (c.width > v.width * 0.6) { // bottom drawer: use its final resting position, not the mid-slide one
    const frac = Number(card.dataset.snap)
    const h = Math.min(card.offsetHeight, frac > 0 && frac <= 1 ? frac * window.innerHeight : card.offsetHeight)
    c = new DOMRect(c.left, window.innerHeight - h, c.width, h)
  }
  const m = 24
  if (n.right < c.left || n.left > c.right || n.bottom < c.top || n.top > c.bottom) return // not covered
  if (c.width > v.width * 0.6) { // bottom sheet (mobile): free area is above it
    const free = c.top - v.top - m
    view.y -= Math.max(0, n.bottom - (v.top + free)) + (n.top < v.top + m ? v.top + m - n.top : 0)
  } else { // side card: free area is to its left
    const dx = n.right - (c.left - m)
    const room = c.left - m - v.left
    view.x -= n.width > room ? n.left - (v.left + m) : dx
  }
}

watch(selectedId, async (id) => {
  if (!id) return
  await nextTick()
  requestAnimationFrame(revealSelected)
  setTimeout(revealSelected, 150) // the mobile drawer mounts/measures a bit later
})

defineExpose({ revealSelected, center, fit, zoom, exportSvg, focusNode })
onMounted(() => {
  isCoarse.value = window.matchMedia('(pointer: coarse)').matches
  nextTick(fit)
})
</script>

<template>
  <ContextMenu>
  <ContextMenuTrigger as-child>
  <svg
    ref="svg"
    class="size-full touch-none select-none"
    :class="mode === 'link' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'"
    @pointerdown.capture="trackPointer"
    @pointerdown="onBgDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @wheel.prevent="onWheel"
    @dblclick="onBgDblClick"
    @contextmenu.capture="onContext($event, null)"
  >
    <defs>
      <pattern id="er-grid" width="24" height="24" patternUnits="userSpaceOnUse" :patternTransform="`translate(${view.x} ${view.y}) scale(${view.k})`">
        <circle cx="1" cy="1" r="1" :fill="c.grid" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" :fill="c.paper" />
    <rect width="100%" height="100%" fill="url(#er-grid)" />

    <g ref="content" :transform="`translate(${view.x} ${view.y}) scale(${view.k})`" font-family="Arial, Helvetica, sans-serif">
      <!-- relationship ↔ entity lines -->
      <g v-for="l in lines" :key="l.id">
        <line :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" :stroke="c.ink" stroke-width="1.5" />
        <circle v-if="l.identifying" :cx="l.x2" :cy="l.y2" r="8" :fill="c.ink" />
        <text :x="l.lx" :y="l.ly" text-anchor="middle" dominant-baseline="central" font-size="12.5" font-weight="600" :fill="c.ink" :stroke="c.paper" stroke-width="4" paint-order="stroke">{{ l.card }}</text>
      </g>

      <!-- generalizations -->
      <g v-for="d in gens" :key="d.g.id" :data-id="d.g.id" :class="autoLayout ? 'cursor-pointer' : 'cursor-move'" @pointerdown.stop="onNodeDown($event, d.g)" @contextmenu="onContext($event, d.g)">
        <line v-for="cl in d.childLines" :key="cl.id" :x1="cl.from.x" :y1="cl.from.y" :x2="cl.to.x" :y2="cl.to.y" :stroke="c.ink" stroke-width="1.5" />
        <line v-if="d.parentLine" :x1="d.parentLine.from.x" :y1="d.parentLine.from.y" :x2="d.parentLine.to.x" :y2="d.parentLine.to.y" :stroke="c.ink" stroke-width="3.5" />
        <text :x="d.lx" :y="d.ly" text-anchor="middle" dominant-baseline="central" font-size="12.5" font-weight="600" :fill="c.ink" :stroke="c.paper" stroke-width="4" paint-order="stroke">{{ d.notation }}</text>
        <g v-for="st in d.stubs" :key="st.label" data-ui pointer-events="none">
          <line :x1="st.x1" :y1="st.y1" :x2="st.x2" :y2="st.y2" :stroke="c.warn" stroke-width="1.5" stroke-dasharray="5 4" />
          <circle :cx="st.x2" :cy="st.y2" r="4" fill="none" :stroke="c.warn" stroke-width="1.5" stroke-dasharray="2 2" />
          <text :x="st.lx" :y="st.ly" text-anchor="middle" dominant-baseline="central" font-size="11" font-style="italic" :fill="c.warn">{{ st.label }}</text>
        </g>
        <circle v-if="isSel(d.g) || rubber?.target === d.g.id" data-ui :cx="d.g.x" :cy="d.g.y" r="14" fill="none" :stroke="rubber?.target === d.g.id ? c.warn : c.sel" stroke-width="2" stroke-dasharray="4 3" />
        <circle :cx="d.g.x" :cy="d.g.y" r="6" :fill="c.ink" />
        <g v-if="warned[d.g.id]" data-ui :transform="`translate(${d.g.x + 14} ${d.g.y - 14})`">
          <circle r="9" fill="#f59e0b" :stroke="c.paper" stroke-width="2" />
          <text text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="800" fill="#fff">!</text>
          <title>{{ warned[d.g.id]!.map(w => w.message).join('\n') }}</title>
        </g>

        <polygon v-if="d.arrow" :transform="`translate(${d.arrow.x} ${d.arrow.y}) rotate(${d.angle})`" points="0,0 -26,-14 -26,14" :fill="d.g.total ? c.ink : c.paper" :stroke="c.ink" stroke-width="2" stroke-linejoin="round" />
      </g>

      <!-- entities -->
      <g v-for="e in diagram.entities" :key="e.id" :data-id="e.id" :transform="`translate(${e.x} ${e.y})`" :class="autoLayout ? 'cursor-pointer' : 'cursor-move'" @pointerdown.stop="onNodeDown($event, e)" @contextmenu="onContext($event, e)">
        <ErAttributes :attributes="e.attributes" :spine-x="-nodeSize(e).w / 2 + 18" :start-y="combDir(e.id) * nodeSize(e).h / 2" :dir="combDir(e.id)" :key-line="attrKeyIsComposite(e)" />
        <rect v-if="isSel(e) || isPending(e) || rubber?.target === e.id" data-ui :x="outline(e).x" :y="outline(e).y" :width="outline(e).w" :height="outline(e).h" rx="3" fill="none" :stroke="isPending(e) || rubber?.target === e.id ? c.warn : c.sel" stroke-width="2" stroke-dasharray="5 3" />
        <rect :x="-nodeSize(e).w / 2" :y="-nodeSize(e).h / 2" :width="nodeSize(e).w" :height="nodeSize(e).h" :fill="c.paper" :stroke="c.ink" stroke-width="2" />
        <text text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="700" :fill="c.ink">{{ e.name }}</text>
        <g v-if="warned[e.id]" data-ui :transform="`translate(${nodeSize(e).w / 2} ${-nodeSize(e).h / 2})`">
          <circle r="9" fill="#f59e0b" :stroke="c.paper" stroke-width="2" />
          <text text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="800" fill="#fff">!</text>
          <title>{{ warned[e.id]!.map(w => w.message).join('\n') }}</title>
        </g>
      </g>

      <!-- relationships -->
      <g v-for="r in diagram.relationships" :key="r.id" :data-id="r.id" :transform="`translate(${r.x} ${r.y})`" :class="autoLayout ? 'cursor-pointer' : 'cursor-move'" @pointerdown.stop="onNodeDown($event, r)" @contextmenu="onContext($event, r)">
        <ErAttributes :attributes="r.attributes" :spine-x="0" :start-y="combDir(r.id) * nodeSize(r).h / 2" :dir="combDir(r.id)" />
        <polygon v-if="isSel(r) || isPending(r) || rubber?.target === r.id" data-ui :points="outline(r).points" fill="none" :stroke="isPending(r) || rubber?.target === r.id ? c.warn : c.sel" stroke-width="2" stroke-dasharray="5 3" />
        <polygon :points="diamond(r)" :fill="c.paper" :stroke="c.ink" stroke-width="2" stroke-linejoin="round" />
        <text text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="600" :fill="c.ink">{{ r.name }}</text>
        <g v-if="warned[r.id]" data-ui :transform="`translate(${nodeSize(r).w / 4} ${-nodeSize(r).h / 4})`">
          <circle r="9" fill="#f59e0b" :stroke="c.paper" stroke-width="2" />
          <text text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="800" fill="#fff">!</text>
          <title>{{ warned[r.id]!.map(w => w.message).join('\n') }}</title>
        </g>
      </g>

      <!-- composite identifiers: drawn above the nodes so they stay visible where they meet the boxes -->
      <g pointer-events="none">
      <g v-for="k in keyCrosses" :key="k.id">
        <path :d="k.d" fill="none" :stroke="c.ink" stroke-width="1.5" stroke-linejoin="round" />
        <circle :cx="k.dot.x" :cy="k.dot.y" r="3.5" :fill="c.ink" />
      </g>
      </g>

      <!-- connect handle (selected node) and rubber band -->
      <g v-if="handle && !rubber" data-ui class="cursor-crosshair" @pointerdown.stop="onHandleDown">
        <line :x1="handle.node.x" :y1="handle.node.y" :x2="handle.x" :y2="handle.y" :stroke="c.sel" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.7" />
        <circle :cx="handle.x" :cy="handle.y" :r="hs * (isCoarse ? 32 : 18)" fill="transparent" />
        <circle :cx="handle.x" :cy="handle.y" :r="hs * (isCoarse ? 18 : 11)" :fill="c.sel" />
        <path :d="`M${handle.x - hs * 6} ${handle.y}h${hs * 12}M${handle.x} ${handle.y - hs * 6}v${hs * 12}`" stroke="#fff" :stroke-width="hs * 2.2" stroke-linecap="round" />
        <title>{{ t('canvas.handle') }}</title>
      </g>
      <line v-if="rubber" data-ui :x1="rubber.from.x" :y1="rubber.from.y" :x2="rubber.x" :y2="rubber.y" :stroke="rubber.target ? c.warn : c.sel" stroke-width="2" stroke-dasharray="6 4" pointer-events="none" />
    </g>
  </svg>
  </ContextMenuTrigger>

  <ContextMenuContent class="w-56">
    <template v-if="ctxNode?.kind === 'entity' || ctxNode?.kind === 'relationship'">
      <ContextMenuLabel class="truncate">{{ ctxNode.name }}</ContextMenuLabel>
      <ContextMenuItem @select="rename"><Icon name="lucide:pencil" /> {{ t('ctx.rename') }} <ContextMenuShortcut>{{ key('rename') }}</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem @select="addAttribute(ctxNode)"><Icon name="lucide:circle-plus" /> {{ t('ctx.addAttribute') }} <ContextMenuShortcut>{{ key('addAttribute') }}</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuSub v-if="ctxNode.kind === 'relationship'">
        <ContextMenuSubTrigger :disabled="!diagram.entities.length" class="data-disabled:pointer-events-none data-disabled:opacity-40"><Icon name="lucide:cable" /> {{ t('ctx.connectTo') }}</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem v-for="e in diagram.entities" :key="e.id" @select="connectNodes(ctxNode as Relationship, e)">{{ e.name }}</ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <template v-else>
        <ContextMenuSub>
          <ContextMenuSubTrigger :disabled="!diagram.relationships.length" class="data-disabled:pointer-events-none data-disabled:opacity-40"><Icon name="lucide:cable" /> {{ t('ctx.connectToRel') }}</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem v-for="r in diagram.relationships" :key="r.id" @select="connectNodes(ctxNode, r)">{{ r.name }}</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger :disabled="!diagram.generalizations.length" class="data-disabled:pointer-events-none data-disabled:opacity-40"><Icon name="lucide:triangle" /> {{ t('ctx.attachGen') }}</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem v-for="(g, i) in diagram.generalizations" :key="g.id" @select="connectNodes(ctxNode, g)">
              {{ t('ctx.genN', { n: i + 1 }) }}{{ g.parentId ? '' : t('ctx.asParent') }}
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem @select="addRelationshipFor(ctxNode.id)"><Icon name="lucide:diamond" /> {{ t('ctx.newRel') }}</ContextMenuItem>
        <ContextMenuItem @select="addGeneralizationFor(ctxNode.id)"><Icon name="lucide:triangle" /> {{ t('ctx.newGen') }} <ContextMenuShortcut>{{ key('addGeneralization') }}</ContextMenuShortcut></ContextMenuItem>
      </template>
      <ContextMenuSeparator />
      <ContextMenuItem @select="duplicate(ctxNode.id)"><Icon name="lucide:copy" /> {{ t('ctx.duplicate') }} <ContextMenuShortcut>{{ key('duplicate') }}</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem variant="destructive" @select="remove(ctxNode.id)"><Icon name="lucide:trash-2" /> {{ t('ctx.delete') }} <ContextMenuShortcut>{{ key('delete') }}</ContextMenuShortcut></ContextMenuItem>
    </template>

    <template v-else-if="ctxNode?.kind === 'generalization'">
      <ContextMenuLabel>{{ t('ctx.generalization') }}</ContextMenuLabel>
      <ContextMenuItem @select="(ctxNode as Generalization).total = !(ctxNode as Generalization).total">
        <Icon name="lucide:arrow-left-right" /> {{ (ctxNode as Generalization).total ? t('ctx.makePartial') : t('ctx.makeTotal') }}
      </ContextMenuItem>
      <ContextMenuItem @select="(ctxNode as Generalization).exclusive = (ctxNode as Generalization).exclusive === false">
        <Icon name="lucide:arrow-left-right" /> {{ (ctxNode as Generalization).exclusive === false ? t('ctx.makeExclusive') : t('ctx.makeOverlapping') }}
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger :disabled="!diagram.entities.length" class="data-disabled:pointer-events-none data-disabled:opacity-40"><Icon name="lucide:cable" /> {{ t('ctx.setParent') }}</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem v-for="e in diagram.entities" :key="e.id" @select="connectNodes(ctxNode, e)">
            {{ e.name }}{{ (ctxNode as Generalization).parentId ? '' : t('ctx.asParent') }}
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" @select="remove(ctxNode.id)"><Icon name="lucide:trash-2" /> {{ t('ctx.delete') }} <ContextMenuShortcut>{{ key('delete') }}</ContextMenuShortcut></ContextMenuItem>
    </template>

    <template v-else>
      <ContextMenuLabel>{{ t('ctx.addHere') }}</ContextMenuLabel>
      <ContextMenuItem @select="addEntity(ctxPoint.x, ctxPoint.y)"><Icon name="lucide:square" /> {{ t('tool.entity') }}</ContextMenuItem>
      <ContextMenuItem @select="addRelationship(ctxPoint.x, ctxPoint.y)"><Icon name="lucide:diamond" /> {{ t('tool.relationship') }}</ContextMenuItem>
      <ContextMenuItem @select="addGeneralization(ctxPoint.x, ctxPoint.y)"><Icon name="lucide:triangle" /> {{ t('tool.generalization') }}</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem @select="runLayout({ fit: true })"><Icon name="lucide:wand-sparkles" /> {{ t('ctx.arrange') }}</ContextMenuItem>
      <ContextMenuItem @select="fit"><Icon name="lucide:maximize" /> {{ t('ctx.fit') }}</ContextMenuItem>
    </template>
  </ContextMenuContent>
  </ContextMenu>

  <Popover v-model:open="choiceOpen">
    <PopoverAnchor as-child>
      <span class="pointer-events-none absolute size-0" :style="{ left: `${choice?.left ?? 0}px`, top: `${choice?.top ?? 0}px` }" />
    </PopoverAnchor>
    <PopoverContent v-if="choice" class="w-72 space-y-1 p-2" align="start" @open-auto-focus.prevent>
      <p class="px-2 py-1 text-xs font-medium text-muted-foreground">
        {{ t('choice.title', { a: choice.a.name, b: choice.b.name }) }}
      </p>
      <Button variant="ghost" class="h-auto w-full justify-start py-2 text-left whitespace-normal" @click="addRelationshipBetween(choice.a, choice.b); choice = null">
        <Icon name="lucide:diamond" /> {{ t('choice.newRel') }}
      </Button>
      <Button variant="ghost" class="h-auto w-full justify-start py-2 text-left whitespace-normal" @click="makeChildOf(choice.a, choice.b); choice = null">
        <Icon name="lucide:triangle" /> {{ t('choice.childOf', { a: choice.a.name, b: choice.b.name }) }}
      </Button>
      <Button variant="ghost" class="h-auto w-full justify-start py-2 text-left whitespace-normal" @click="makeChildOf(choice.b, choice.a); choice = null">
        <Icon name="lucide:triangle" /> {{ t('choice.childOf', { a: choice.b.name, b: choice.a.name }) }}
      </Button>
    </PopoverContent>
  </Popover>

  <div v-if="isEmpty" class="pointer-events-none absolute inset-0 flex items-center justify-center">
    <p class="rounded-lg bg-background/90 px-4 py-3 text-sm text-muted-foreground shadow-sm ring-1 ring-border">
      {{ t('canvas.empty') }}
    </p>
  </div>
</template>
