import type { Diagram } from '~/types/er'

/** Entities that take part in no relationship and no generalization. */
export function isolatedEntityIds(d: Diagram): Set<string> {
  const used = new Set<string>()
  for (const r of d.relationships) for (const l of r.links) used.add(l.entityId)
  for (const g of d.generalizations) for (const id of [g.parentId, ...g.childIds]) if (id) used.add(id)
  return new Set(d.entities.filter(e => !used.has(e.id)).map(e => e.id))
}

/** Copy of the diagram without its unconnected entities. */
export function withoutUnconnected(d: Diagram): Diagram {
  const gone = isolatedEntityIds(d)
  return { ...d, entities: d.entities.filter(e => !gone.has(e.id)) }
}
