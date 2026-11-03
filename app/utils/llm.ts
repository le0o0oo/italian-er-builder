import type { Card, Diagram } from '~/types/er'
import { uid } from '~/composables/useDiagram'

const CARDS: Card[] = ['0,1', '1,1', '0,N', '1,N']

/** Prompt the user pastes into any LLM; the reply is JSON that `parseDiagram` accepts. */
export const LLM_PROMPT = `You are helping me draw an entity-relationship (ER) diagram in the Italian notation, in a tool called ER Builder.
Reply with ONE JSON object inside a single \`\`\`json code block, and nothing else. Do not add comments.

Schema:
{
  "entities": [
    { "id": "emp", "kind": "entity", "name": "Employee", "x": 0, "y": 0,
      "attributes": [ { "id": "a1", "name": "SSN", "identifier": true, "card": "1,1" } ] }
  ],
  "relationships": [
    { "id": "wi", "kind": "relationship", "name": "Works in", "x": 0, "y": 0,
      "attributes": [ { "id": "a2", "name": "Since", "identifier": false, "card": "1,1" } ],
      "links": [
        { "id": "l1", "entityId": "emp", "card": "1,1", "identifying": false },
        { "id": "l2", "entityId": "dep", "card": "1,N", "identifying": false }
      ] }
  ],
  "generalizations": [
    { "id": "g1", "kind": "generalization", "x": 0, "y": 0, "parentId": "emp", "childIds": ["mgr"], "total": false, "exclusive": true }
  ]
}

Rules:
- All ids are short, unique strings. Always set x and y to 0: the tool lays the diagram out automatically.
- "card" is one of "0,1", "1,1", "0,N", "1,N" and is (min,max). On an attribute, "1,1" is the default; use "0,1" for optional and "0,N" / "1,N" for multivalued attributes.
- "identifier": true marks an attribute as part of the entity's key (several marked attributes form a composite key). Only entities have keys.
- "derived": true (optional) marks an attribute that is computed from other data. A derived attribute must never be an identifier.
- Every relationship needs at least 2 links. Each link's "entityId" is the id of an entity and "card" is that entity's participation cardinality in the relationship.
- "identifying": true on a link means the entity is identified externally through that relationship (its link card should then be "1,1").
- Generalizations (IS-A): "parentId" is the parent entity id, "childIds" are the child entity ids. "total": true if every parent is in some child, "exclusive": true if the children are disjoint. Child entities inherit the parent's key and must not define their own.
- Every entity except generalization children should have an identifier or an identifying link.
- Keep names in the same language as my description.

The diagram to draw:
`

function fail(): never { throw new Error('bad shape') }

/** Accepts raw JSON or an LLM reply (code fences, surrounding text) and returns a clean, valid Diagram. */
export function parseDiagram(text: string): Diagram {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) fail()
  const raw = JSON.parse(text.slice(start, end + 1))
  if (!raw || typeof raw !== 'object') fail()
  const list = (v: unknown): Record<string, any>[] => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : [])
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const card = (v: unknown): Card => (CARDS.includes(v as Card) ? (v as Card) : '1,1')
  const used = new Set<string>()
  const id = (v: unknown) => {
    let s = typeof v === 'string' && v && !used.has(v) ? v : uid()
    while (used.has(s)) s = uid()
    used.add(s)
    return s
  }
  const attrs = (v: unknown, keys: boolean) => list(v).map(a => ({
    id: id(a.id),
    name: String(a.name ?? ''),
    identifier: keys && a.identifier === true && a.derived !== true,
    card: card(a.card),
    ...(a.derived === true ? { derived: true } : {}),
  }))

  if (!Array.isArray(raw.entities) && !Array.isArray(raw.relationships)) fail()
  const entities = list(raw.entities).map(e => ({ id: id(e.id), kind: 'entity' as const, name: String(e.name ?? ''), x: num(e.x), y: num(e.y), attributes: attrs(e.attributes, true) }))
  const entityIds = new Set(entities.map(e => e.id))
  const relationships = list(raw.relationships).map(r => ({
    id: id(r.id),
    kind: 'relationship' as const,
    name: String(r.name ?? ''),
    x: num(r.x),
    y: num(r.y),
    attributes: attrs(r.attributes, false),
    links: list(r.links).filter(l => entityIds.has(l.entityId)).map(l => ({ id: id(l.id), entityId: String(l.entityId), card: card(l.card), identifying: l.identifying === true })),
  }))
  const generalizations = list(raw.generalizations).map(g => ({
    id: id(g.id),
    kind: 'generalization' as const,
    x: num(g.x),
    y: num(g.y),
    parentId: entityIds.has(g.parentId) ? String(g.parentId) : null,
    childIds: (Array.isArray(g.childIds) ? g.childIds : []).filter((c: unknown) => entityIds.has(c as string)).map(String),
    total: g.total === true,
    exclusive: g.exclusive !== false,
  }))
  return { entities, relationships, generalizations }
}
