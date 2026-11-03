import type { Diagram } from '~/types/er'

export interface Placed { x: number, y: number }
/** Layout box of a node relative to its centre, attribute list included. */
export interface LNode { id: string, entity: boolean, l: number, r: number, t: number, b: number, bw: number, bh: number }

const labelWidth = (names: string[]) => Math.max(0, ...names.map(n => n.length * 7 + 44))
const attrNames = (as: { name: string, card: string }[]) => as.map(a => a.name + (a.card === '1,1' ? '' : '(0,N)'))

export function buildLayoutNodes(d: Diagram) {
  const nodes: LNode[] = []
  const index = new Map<string, number>()
  const crow = notation.value === 'crow'
  const add = (n: LNode) => { index.set(n.id, nodes.length); nodes.push(n) }

  for (const e of d.entities) {
    const { w, h } = nodeSize(e)
    const comb = crow || !e.attributes.length ? 0 : 14 + e.attributes.length * 24
    add({ id: e.id, entity: true, l: -w / 2, r: crow ? w / 2 : Math.max(w / 2, -w / 2 + 18 + labelWidth(attrNames(e.attributes))), t: -h / 2, b: h / 2 + comb, bw: w / 2, bh: h / 2 })
  }
  for (const r of d.relationships) {
    const { w, h } = nodeSize(r)
    const comb = crow || !r.attributes.length ? 0 : 14 + r.attributes.length * 24
    add({ id: r.id, entity: false, l: -w / 2, r: crow ? w / 2 : Math.max(w / 2, labelWidth(attrNames(r.attributes))), t: -h / 2, b: h / 2 + comb, bw: w / 2, bh: h / 2 })
  }
  for (const g of d.generalizations) add({ id: g.id, entity: false, l: -24, r: 24, t: -24, b: 24, bw: 24, bh: 24 })
  return { nodes, index }
}
