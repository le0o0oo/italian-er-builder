import type { Diagram } from '~/types/er'

export interface Placed { x: number, y: number }
/** Layout box of a node relative to its centre, attribute list included. */
export interface LNode { id: string, entity: boolean, l: number, r: number, t: number, b: number }

const labelWidth = (names: string[]) => Math.max(0, ...names.map(n => n.length * 7 + 44))
const attrNames = (as: { name: string, card: string }[]) => as.map(a => a.name + (a.card === '1,1' ? '' : '(0,N)'))

export function buildLayoutNodes(d: Diagram) {
  const nodes: LNode[] = []
  const index = new Map<string, number>()
  const add = (n: LNode) => { index.set(n.id, nodes.length); nodes.push(n) }

  for (const e of d.entities) {
    const { w, h } = nodeSize(e)
    const comb = e.attributes.length ? 14 + e.attributes.length * 24 : 0
    add({ id: e.id, entity: true, l: -w / 2, r: Math.max(w / 2, -w / 2 + 18 + labelWidth(attrNames(e.attributes))), t: -h / 2, b: h / 2 + comb })
  }
  for (const r of d.relationships) {
    const { w, h } = nodeSize(r)
    const comb = r.attributes.length ? 14 + r.attributes.length * 24 : 0
    add({ id: r.id, entity: false, l: -w / 2, r: Math.max(w / 2, labelWidth(attrNames(r.attributes))), t: -h / 2, b: h / 2 + comb })
  }
  for (const g of d.generalizations) add({ id: g.id, entity: false, l: -24, r: 24, t: -24, b: 24 })
  return { nodes, index }
}
