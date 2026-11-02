import type { Card, Diagram, DiagramNode, Entity, Generalization, Relationship } from '~/types/er'

const STORAGE_KEY = 'er-maker:diagram'
export const uid = () => Math.random().toString(36).slice(2, 9)

export const emptyDiagram = (): Diagram => ({ entities: [], relationships: [], generalizations: [] })

export function sampleDiagram(): Diagram {
  const a = (name: string, identifier = false, card: Card = '1,1') => ({ id: uid(), name, identifier, card })
  const emp: Entity = { id: 'emp', kind: 'entity', name: 'Employee', x: 0, y: 0, attributes: [a('SSN', true), a('Name'), a('Surname'), a('Phone', false, '0,N')] }
  const dep: Entity = { id: 'dep', kind: 'entity', name: 'Department', x: 528, y: 0, attributes: [a('Name', true), a('Phone')] }
  const prj: Entity = { id: 'prj', kind: 'entity', name: 'Project', x: 528, y: 288, attributes: [a('Code', true), a('Budget')] }
  const mgr: Entity = { id: 'mgr', kind: 'entity', name: 'Manager', x: 0, y: -228, attributes: [] }
  const worksIn: Relationship = {
    id: 'wi', kind: 'relationship', name: 'Works in', x: 264, y: 0, attributes: [a('Since')],
    links: [{ id: uid(), entityId: 'emp', card: '1,1', identifying: false }, { id: uid(), entityId: 'dep', card: '1,N', identifying: false }],
  }
  const assigned: Relationship = {
    id: 'as', kind: 'relationship', name: 'Assigned to', x: 264, y: 288, attributes: [a('Hours')],
    links: [{ id: uid(), entityId: 'emp', card: '0,N', identifying: false }, { id: uid(), entityId: 'prj', card: '1,N', identifying: false }],
  }
  // Identified by two relationships (+ one attribute): the composite-key case.
  const alloc: Entity = { id: 'alc', kind: 'entity', name: 'Allocation', x: 1056, y: 144, attributes: [a('Date', true), a('Quantity')] }
  const requestedBy: Relationship = {
    id: 'rb', kind: 'relationship', name: 'Requested by', x: 792, y: 0, attributes: [],
    links: [{ id: uid(), entityId: 'dep', card: '0,N', identifying: false }, { id: uid(), entityId: 'alc', card: '1,1', identifying: true }],
  }
  const chargedTo: Relationship = {
    id: 'ct', kind: 'relationship', name: 'Charged to', x: 792, y: 288, attributes: [],
    links: [{ id: uid(), entityId: 'prj', card: '0,N', identifying: false }, { id: uid(), entityId: 'alc', card: '1,1', identifying: true }],
  }
  const gen: Generalization = { id: 'gen', kind: 'generalization', x: 0, y: -120, parentId: 'emp', childIds: ['mgr'], total: false, exclusive: true }
  return { entities: [emp, dep, prj, mgr, alloc], relationships: [worksIn, assigned, requestedBy, chargedTo], generalizations: [gen] }
}

// ---- undo / redo (module-level so every component shares one history) ----
let history: string[] = []
const histIndex = ref(-1)
const histSize = ref(0)
let restoring = false
let timer: ReturnType<typeof setTimeout> | undefined

export function useDiagram() {
  const diagram = useState<Diagram>('er-diagram', emptyDiagram)
  const selectedId = useState<string | null>('er-selected', () => null)
  const mode = useState<'select' | 'link'>('er-mode', () => 'select')
  const pendingId = useState<string | null>('er-pending', () => null)

  const find = (id: string | null | undefined): DiagramNode | undefined => {
    if (!id) return undefined
    const d = diagram.value
    return d.entities.find(n => n.id === id) ?? d.relationships.find(n => n.id === id) ?? d.generalizations.find(n => n.id === id)
  }
  const selected = computed(() => find(selectedId.value))
  const isEmpty = computed(() => !diagram.value.entities.length && !diagram.value.relationships.length && !diagram.value.generalizations.length)

  const select = (id: string | null) => { selectedId.value = id }
  const setMode = (m: 'select' | 'link') => { mode.value = m; pendingId.value = null }

  function addEntity(x: number, y: number) {
    const n: Entity = { id: uid(), kind: 'entity', name: `Entity ${diagram.value.entities.length + 1}`, x: snap(x), y: snap(y), attributes: [] }
    diagram.value.entities.push(n)
    select(n.id)
  }
  function addRelationship(x: number, y: number) {
    const n: Relationship = { id: uid(), kind: 'relationship', name: `Relationship ${diagram.value.relationships.length + 1}`, x: snap(x), y: snap(y), attributes: [], links: [] }
    diagram.value.relationships.push(n)
    select(n.id)
  }
  function addGeneralization(x: number, y: number) {
    const n: Generalization = { id: uid(), kind: 'generalization', x: snap(x), y: snap(y), parentId: null, childIds: [], total: false, exclusive: true }
    diagram.value.generalizations.push(n)
    select(n.id)
  }
  function addLink(relId: string, entityId: string) {
    const rel = diagram.value.relationships.find(r => r.id === relId)
    if (!rel) return
    rel.links.push({ id: uid(), entityId, card: '0,N', identifying: false })
    select(rel.id)
  }
  /**
   * Connects two nodes if the pair makes sense: relationship↔entity adds a link,
   * generalization↔entity sets the parent (if free) or adds a child.
   */
  function connectNodes(a: DiagramNode, b: DiagramNode): boolean {
    if (a.id === b.id) return false
    const rel = [a, b].find(n => n.kind === 'relationship') as Relationship | undefined
    const gen = [a, b].find(n => n.kind === 'generalization') as Generalization | undefined
    const ent = [a, b].find(n => n.kind === 'entity') as Entity | undefined
    if (!ent) return false
    if (rel) { addLink(rel.id, ent.id); return true }
    if (gen) {
      if (gen.parentId === ent.id || gen.childIds.includes(ent.id)) return false
      if (!gen.parentId) gen.parentId = ent.id
      else gen.childIds.push(ent.id)
      select(gen.id)
      return true
    }
    return false
  }
  /** New relationship placed between two entities and linked to both. */
  function addRelationshipBetween(a: Entity, b: Entity) {
    const n: Relationship = {
      id: uid(), kind: 'relationship', name: `Relationship ${diagram.value.relationships.length + 1}`,
      x: snap((a.x + b.x) / 2), y: snap((a.y + b.y) / 2), attributes: [],
      links: [{ id: uid(), entityId: a.id, card: '0,N', identifying: false }, { id: uid(), entityId: b.id, card: '0,N', identifying: false }],
    }
    diagram.value.relationships.push(n)
    select(n.id)
  }
  /** New relationship next to an entity, already linked to it. */
  function addRelationshipFor(entityId: string) {
    const e = diagram.value.entities.find(x => x.id === entityId)
    if (!e) return
    const n: Relationship = {
      id: uid(), kind: 'relationship', name: `Relationship ${diagram.value.relationships.length + 1}`,
      x: snap(e.x + nodeSize(e).w / 2 + 144), y: snap(e.y), attributes: [],
      links: [{ id: uid(), entityId: e.id, card: '0,N', identifying: false }],
    }
    diagram.value.relationships.push(n)
    select(n.id)
  }
  /** Makes `child` a child of `parent`, reusing the parent's generalization if it already has one. */
  function makeChildOf(child: Entity, parent: Entity) {
    let g = diagram.value.generalizations.find(x => x.parentId === parent.id)
    if (!g) {
      g = { id: uid(), kind: 'generalization', x: snap((child.x + parent.x) / 2), y: snap((child.y + parent.y) / 2), parentId: parent.id, childIds: [], total: false, exclusive: true }
      diagram.value.generalizations.push(g)
    }
    if (!g.childIds.includes(child.id)) g.childIds.push(child.id)
    select(g.id)
  }
  function addAttribute(node: Entity | Relationship) {
    const a = { id: uid(), name: `attribute${node.attributes.length + 1}`, identifier: false, card: '1,1' as Card }
    node.attributes.push(a)
    // Let the user type the name straight away.
    nextTick(() => setTimeout(() => {
      const el = document.getElementById(`attr-${a.id}`) as HTMLInputElement | null
      el?.focus()
      el?.select()
    }, 50))
  }
  function remove(id: string) {
    const d = diagram.value
    d.entities = d.entities.filter(n => n.id !== id)
    d.relationships = d.relationships.filter(n => n.id !== id)
    d.generalizations = d.generalizations.filter(n => n.id !== id)
    for (const r of d.relationships) r.links = r.links.filter(l => l.entityId !== id)
    for (const g of d.generalizations) {
      if (g.parentId === id) g.parentId = null
      g.childIds = g.childIds.filter(c => c !== id)
    }
    if (selectedId.value === id) selectedId.value = null
    if (pendingId.value === id) pendingId.value = null
  }
  function load(d: Diagram) {
    diagram.value = d
    selectedId.value = null
    pendingId.value = null
  }

  function record() {
    clearTimeout(timer)
    timer = undefined
    const s = JSON.stringify(diagram.value)
    if (history[histIndex.value] === s) return
    history = history.slice(0, histIndex.value + 1)
    history.push(s)
    if (history.length > 100) history.shift()
    histIndex.value = history.length - 1
    histSize.value = history.length
  }
  function restore(i: number) {
    restoring = true
    histIndex.value = i
    diagram.value = JSON.parse(history[i]!)
    nextTick(() => { restoring = false })
  }
  function undo() {
    if (timer) record()
    if (histIndex.value > 0) restore(histIndex.value - 1)
  }
  function redo() {
    if (histIndex.value < history.length - 1) restore(histIndex.value + 1)
  }
  const canUndo = computed(() => histIndex.value > 0)
  const canRedo = computed(() => histIndex.value < histSize.value - 1)

  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
  function duplicate(id: string) {
    const n = find(id)
    if (!n || n.kind === 'generalization') return
    const copy = clone(n)
    copy.id = uid()
    copy.name = `${n.name} copy`
    copy.x += 36
    copy.y += 36
    copy.attributes.forEach(a => (a.id = uid()))
    if (copy.kind === 'relationship') copy.links.forEach(l => (l.id = uid()))
    if (copy.kind === 'entity') diagram.value.entities.push(copy)
    else diagram.value.relationships.push(copy)
    select(copy.id)
  }
  /** New generalization placed above an entity, with it as the parent. */
  function addGeneralizationFor(entityId: string) {
    const e = diagram.value.entities.find(x => x.id === entityId)
    if (!e) return
    const n: Generalization = { id: uid(), kind: 'generalization', x: snap(e.x), y: snap(e.y - 120), parentId: e.id, childIds: [], total: false, exclusive: true }
    diagram.value.generalizations.push(n)
    select(n.id)
  }

  const autoLayout = useState('er-auto-layout', () => false)
  const fitRequest = useState('er-fit-request', () => 0)

  let tween = 0
  /** Move every node to its computed position (animated). */
  function runLayout(opts: { fit?: boolean, animate?: boolean } = {}) {
    const target = computeLayout(diagram.value)
    const all = [...diagram.value.entities, ...diagram.value.relationships, ...diagram.value.generalizations]
    const from = all.map(n => ({ n, x: n.x, y: n.y }))
    const token = ++tween
    const start = performance.now()
    const DURATION = opts.animate === false ? 0 : 320
    const step = (now: number) => {
      if (token !== tween) return
      const t = DURATION ? Math.min(1, (now - start) / DURATION) : 1
      const e = 1 - (1 - t) ** 3
      for (const f of from) {
        const to = target.get(f.n.id)
        if (!to) continue
        f.n.x = f.x + (to.x - f.x) * e
        f.n.y = f.y + (to.y - f.y) * e
      }
      if (t < 1) requestAnimationFrame(step)
      else if (opts.fit) fitRequest.value++
    }
    requestAnimationFrame(step)
  }
  function setAutoLayout(on: boolean) {
    autoLayout.value = on
    try { localStorage.setItem(`${STORAGE_KEY}:auto`, on ? '1' : '0') }
    catch { /* storage unavailable */ }
    if (on) runLayout({ fit: true })
  }

  /** Everything that affects layout except the positions themselves. */
  const structure = computed(() => JSON.stringify([
    diagram.value.entities.map(e => [e.id, e.name, e.attributes.map(a => [a.name, a.card])]),
    diagram.value.relationships.map(r => [r.id, r.name, r.attributes.map(a => [a.name, a.card]), r.links.map(l => l.entityId)]),
    diagram.value.generalizations.map(g => [g.id, g.parentId, g.childIds]),
  ]))

  function init() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      diagram.value = raw ? JSON.parse(raw) : sampleDiagram()
    }
    catch { diagram.value = sampleDiagram() }
    history = []
    histIndex.value = -1
    record()
    try { autoLayout.value = localStorage.getItem(`${STORAGE_KEY}:auto`) === '1' }
    catch { /* storage unavailable */ }
    if (autoLayout.value) runLayout({ animate: false })
    let layoutTimer: ReturnType<typeof setTimeout> | undefined
    watch(structure, () => {
      if (!autoLayout.value) return
      clearTimeout(layoutTimer)
      layoutTimer = setTimeout(() => runLayout(), 150)
    })
    watch(diagram, (v) => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)) }
      catch { /* storage unavailable */ }
      if (restoring) return
      clearTimeout(timer)
      timer = setTimeout(record, 300)
    }, { deep: true })
  }

  return { diagram, selectedId, selected, mode, pendingId, isEmpty, find, select, setMode, addEntity, addRelationship, addGeneralization, addLink, connectNodes, addRelationshipBetween, addRelationshipFor, makeChildOf, addAttribute, remove, load, init, undo, redo, canUndo, canRedo, duplicate, addGeneralizationFor, autoLayout, setAutoLayout, runLayout, fitRequest }
}
