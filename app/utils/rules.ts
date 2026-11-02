import type { Diagram } from '~/types/er'
import type { Translate } from '~/utils/i18n'

export interface Rule { id: string, default: boolean }
export interface Warning { id: string, ruleId: string, nodeId: string, message: string }

export const RULES: Rule[] = [
  { id: 'entity-key', default: true },
  { id: 'identifying-card', default: true },
  { id: 'entity-isolated', default: true },
  { id: 'rel-ends', default: true },
  { id: 'gen-complete', default: true },
  { id: 'duplicate-names', default: true },
  { id: 'empty-name', default: true },
  { id: 'attr-duplicates', default: true },
  { id: 'entity-attributes', default: false },
  { id: 'gen-min-children', default: false },
  { id: 'child-own-key', default: false },
  { id: 'default-names', default: false },
]

export const defaultRules = () => Object.fromEntries(RULES.map(r => [r.id, r.default])) as Record<string, boolean>

export function checkDiagram(d: Diagram, on: Record<string, boolean>, t: Translate): Warning[] {
  const out: Warning[] = []
  const warn = (ruleId: string, nodeId: string, message: string) => out.push({ id: `${ruleId}:${nodeId}:${out.length}`, ruleId, nodeId, message })
  const q = (s: string) => `“${s.trim() || t('msg.unnamed')}”`
  const childIds = new Set(d.generalizations.filter(g => g.parentId).flatMap(g => g.childIds))
  const inGeneralization = new Set(d.generalizations.flatMap(g => [g.parentId, ...g.childIds].filter(Boolean) as string[]))
  const linkedEntities = new Set(d.relationships.flatMap(r => r.links.map(l => l.entityId)))

  for (const e of d.entities) {
    const identifyingLinks = d.relationships.flatMap(r => r.links.filter(l => l.entityId === e.id && l.identifying))
    const hasKey = e.attributes.some(a => a.identifier) || identifyingLinks.length > 0
    if (on['entity-key'] && !hasKey && !childIds.has(e.id)) warn('entity-key', e.id, t('msg.entity-key', { name: q(e.name) }))
    if (on['identifying-card']) {
      for (const l of identifyingLinks) if (l.card !== '1,1') warn('identifying-card', e.id, t('msg.identifying-card', { name: q(e.name), card: l.card }))
    }
    if (on['entity-isolated'] && !linkedEntities.has(e.id) && !inGeneralization.has(e.id)) warn('entity-isolated', e.id, t('msg.entity-isolated', { name: q(e.name) }))
    if (on['entity-attributes'] && !e.attributes.length && !childIds.has(e.id)) warn('entity-attributes', e.id, t('msg.entity-attributes', { name: q(e.name) }))
    if (on['child-own-key'] && childIds.has(e.id) && e.attributes.some(a => a.identifier)) warn('child-own-key', e.id, t('msg.child-own-key', { name: q(e.name) }))
  }

  for (const r of d.relationships) {
    if (on['rel-ends'] && r.links.length < 2) warn('rel-ends', r.id, t(r.links.length === 1 ? 'msg.rel-ends.1' : 'msg.rel-ends.0', { name: q(r.name) }))
  }

  const named = [...d.entities, ...d.relationships]
  const counts = new Map<string, number>()
  for (const n of named) counts.set(n.name.trim().toLowerCase(), (counts.get(n.name.trim().toLowerCase()) ?? 0) + 1)
  for (const n of named) {
    const key = n.name.trim().toLowerCase()
    if (on['empty-name'] && !key) warn('empty-name', n.id, t(n.kind === 'entity' ? 'msg.empty-name.entity' : 'msg.empty-name.relationship'))
    else if (on['duplicate-names'] && counts.get(key)! > 1) warn('duplicate-names', n.id, t('msg.duplicate-names', { name: q(n.name) }))
    if (on['default-names'] && /^(Entity|Relationship|Entità|Associazione) \d+$/.test(n.name.trim())) warn('default-names', n.id, t('msg.default-names', { name: q(n.name) }))
    if (on['attr-duplicates']) {
      const seen = new Set<string>()
      const dup = new Set<string>()
      for (const a of n.attributes) {
        const k = a.name.trim().toLowerCase()
        if (seen.has(k)) dup.add(a.name.trim())
        seen.add(k)
      }
      for (const name of dup) warn('attr-duplicates', n.id, t('msg.attr-duplicates', { name: q(n.name), attr: q(name) }))
    }
  }

  d.generalizations.forEach((g, i) => {
    const parent = d.entities.find(e => e.id === g.parentId)
    const label = parent ? t('msg.genOf', { name: q(parent.name) }) : t('msg.genN', { n: i + 1 })
    if (on['gen-complete']) {
      if (!parent) warn('gen-complete', g.id, t('msg.gen-complete.noParent', { label }))
      if (!g.childIds.length) warn('gen-complete', g.id, t('msg.gen-complete.noChildren', { label }))
    }
    if (on['gen-min-children'] && g.childIds.length === 1) warn('gen-min-children', g.id, t('msg.gen-min-children', { label }))
  })

  return out
}
