import type { Diagram } from '~/types/er'

export interface Rule { id: string, label: string, description: string, default: boolean }
export interface Warning { id: string, ruleId: string, nodeId: string, message: string }

export const RULES: Rule[] = [
  { id: 'entity-key', label: 'Entities need a primary key', description: 'An identifier attribute or an identifying relationship. Children of a generalization inherit the parent\'s key.', default: true },
  { id: 'identifying-card', label: 'Identifying relationships are (1,1)', description: 'An entity identified through a relationship must take part exactly once.', default: true },
  { id: 'entity-isolated', label: 'No isolated entities', description: 'Every entity should be connected to a relationship or a generalization.', default: true },
  { id: 'rel-ends', label: 'Relationships link two or more entities', description: 'A relationship with fewer than two connections is incomplete.', default: true },
  { id: 'gen-complete', label: 'Generalizations are complete', description: 'Each needs a parent and at least one child.', default: true },
  { id: 'duplicate-names', label: 'Unique names', description: 'Entities and relationships should not share a name.', default: true },
  { id: 'empty-name', label: 'Everything is named', description: 'Entities and relationships need a non-empty name.', default: true },
  { id: 'attr-duplicates', label: 'Unique attribute names', description: 'No two attributes of the same element share a name.', default: true },
  { id: 'entity-attributes', label: 'Entities have attributes', description: 'Flags entities without any attribute.', default: false },
  { id: 'gen-min-children', label: 'Generalizations have 2+ children', description: 'A specialization with a single child is usually unnecessary.', default: false },
  { id: 'child-own-key', label: 'Children don\'t redefine the key', description: 'Child entities inherit the key, so they shouldn\'t mark their own identifier.', default: false },
  { id: 'default-names', label: 'No default names', description: 'Flags names like “Entity 1” that were never changed.', default: false },
]

export const defaultRules = () => Object.fromEntries(RULES.map(r => [r.id, r.default])) as Record<string, boolean>

export function checkDiagram(d: Diagram, on: Record<string, boolean>): Warning[] {
  const out: Warning[] = []
  const warn = (ruleId: string, nodeId: string, message: string) => out.push({ id: `${ruleId}:${nodeId}:${out.length}`, ruleId, nodeId, message })
  const q = (s: string) => `“${s.trim() || '(unnamed)'}”`
  const childIds = new Set(d.generalizations.filter(g => g.parentId).flatMap(g => g.childIds))
  const inGeneralization = new Set(d.generalizations.flatMap(g => [g.parentId, ...g.childIds].filter(Boolean) as string[]))
  const linkedEntities = new Set(d.relationships.flatMap(r => r.links.map(l => l.entityId)))

  for (const e of d.entities) {
    const identifyingLinks = d.relationships.flatMap(r => r.links.filter(l => l.entityId === e.id && l.identifying))
    const hasKey = e.attributes.some(a => a.identifier) || identifyingLinks.length > 0
    if (on['entity-key'] && !hasKey && !childIds.has(e.id)) warn('entity-key', e.id, `${q(e.name)} has no primary key`)
    if (on['identifying-card']) {
      for (const l of identifyingLinks) if (l.card !== '1,1') warn('identifying-card', e.id, `${q(e.name)} is identified through a relationship with (${l.card}); it should be (1,1)`)
    }
    if (on['entity-isolated'] && !linkedEntities.has(e.id) && !inGeneralization.has(e.id)) warn('entity-isolated', e.id, `${q(e.name)} is not connected to anything`)
    if (on['entity-attributes'] && !e.attributes.length && !childIds.has(e.id)) warn('entity-attributes', e.id, `${q(e.name)} has no attributes`)
    if (on['child-own-key'] && childIds.has(e.id) && e.attributes.some(a => a.identifier)) warn('child-own-key', e.id, `${q(e.name)} is a child and inherits its key, but marks its own identifier`)
  }

  for (const r of d.relationships) {
    if (on['rel-ends'] && r.links.length < 2) warn('rel-ends', r.id, `${q(r.name)} connects ${r.links.length} ${r.links.length === 1 ? 'entity' : 'entities'}; it needs at least 2`)
  }

  const named = [...d.entities, ...d.relationships]
  const counts = new Map<string, number>()
  for (const n of named) counts.set(n.name.trim().toLowerCase(), (counts.get(n.name.trim().toLowerCase()) ?? 0) + 1)
  for (const n of named) {
    const key = n.name.trim().toLowerCase()
    if (on['empty-name'] && !key) warn('empty-name', n.id, `A${n.kind === 'entity' ? 'n entity' : ' relationship'} has no name`)
    else if (on['duplicate-names'] && counts.get(key)! > 1) warn('duplicate-names', n.id, `The name ${q(n.name)} is used more than once`)
    if (on['default-names'] && /^(Entity|Relationship) \d+$/.test(n.name.trim())) warn('default-names', n.id, `${q(n.name)} still has its default name`)
    if (on['attr-duplicates']) {
      const seen = new Set<string>()
      const dup = new Set<string>()
      for (const a of n.attributes) {
        const k = a.name.trim().toLowerCase()
        if (seen.has(k)) dup.add(a.name.trim())
        seen.add(k)
      }
      for (const name of dup) warn('attr-duplicates', n.id, `${q(n.name)} has several attributes named ${q(name)}`)
    }
  }

  d.generalizations.forEach((g, i) => {
    const parent = d.entities.find(e => e.id === g.parentId)
    const label = parent ? `Generalization of ${q(parent.name)}` : `Generalization ${i + 1}`
    if (on['gen-complete']) {
      if (!parent) warn('gen-complete', g.id, `${label} has no parent`)
      if (!g.childIds.length) warn('gen-complete', g.id, `${label} has no children`)
    }
    if (on['gen-min-children'] && g.childIds.length === 1) warn('gen-min-children', g.id, `${label} has only one child`)
  })

  return out
}
