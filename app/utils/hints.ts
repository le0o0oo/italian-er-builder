import type { Diagram, Entity, Relationship } from '~/types/er'
import type { Translate } from '~/utils/i18n'

export interface HintRule { id: string, default: boolean }
export interface Hint { id: string, ruleId: string, nodeId: string, message: string }

/** Hint types, grouped for the panel. Every type (and every group) can be switched off. */
export const HINT_GROUPS: { id: string, rules: string[] }[] = [
  { id: 'common', rules: ['age', 'total-derived', 'full-name', 'address-split', 'multivalued', 'optional-attr', 'numbered-attrs', 'type-attr'] },
  { id: 'naming', rules: ['generic-attr', 'attr-has-entity', 'entity-plural', 'rel-generic-name', 'rel-like-entity'] },
  { id: 'keys', rules: ['natural-id', 'weak-key-name', 'key-too-many', 'key-card', 'rel-key'] },
  { id: 'structure', rules: ['fk-attr', 'attr-is-entity', 'many-attrs', 'tiny-entity', 'shared-attrs'] },
  { id: 'relationships', rules: ['rel-ternary', 'rel-one-to-one', 'rel-recursive', 'rel-parallel', 'rel-attr-move'] },
  { id: 'generalizations', rules: ['gen-dup-attr', 'gen-shared-attr', 'gen-bare-child'] },
]
export const HINT_RULES: HintRule[] = HINT_GROUPS.flatMap(g => g.rules.map(id => ({ id, default: true })))

export const defaultHints = () => Object.fromEntries(HINT_RULES.map(r => [r.id, r.default])) as Record<string, boolean>

// ---- name matching (English + Italian, accents and punctuation ignored) ----
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const wordsOf = (s: string) => norm(s).split(' ').filter(Boolean)
/** true when any word (or multi-word phrase) of `list` appears in the name */
const hasWord = (s: string, list: string[]) => {
  const n = ` ${norm(s)} `
  return list.some(x => n.includes(` ${x} `))
}
/** true when the whole name is one of the entries */
const isName = (s: string, list: string[]) => list.includes(norm(s))

const AGE = ['age', 'eta', 'anni', 'years']
const BIRTH = ['birth', 'birthdate', 'birthday', 'dob', 'born', 'nascita', 'nato', 'nata']
const TOTAL = ['total', 'totale', 'count', 'sum', 'average', 'avg', 'media', 'somma', 'tot', 'number of', 'numero di', 'num di', 'n di', 'n of']
const FULL_NAME = ['full name', 'nome completo', 'nominativo', 'cognome e nome', 'nome e cognome', 'name and surname', 'name surname', 'nome cognome', 'cognome nome']
const FIRST_NAME = ['name', 'nome', 'first name', 'firstname']
const SURNAME = ['surname', 'cognome', 'last name', 'lastname']
const ADDRESS = ['address', 'indirizzo', 'residenza', 'domicilio', 'sede']
const MULTI = ['phone', 'telephone', 'telefono', 'tel', 'cellulare', 'mobile', 'email', 'mail', 'e mail', 'hobby', 'hobbies', 'language', 'languages', 'lingua', 'lingue', 'skill', 'skills', 'competenza', 'competenze', 'phones', 'telefoni', 'emails', 'cellulari']
const OPTIONAL = ['note', 'notes', 'nota', 'fax', 'website', 'web site', 'sito web', 'sito', 'middle name', 'secondo nome', 'nickname', 'soprannome', 'facoltativo', 'optional', 'comment', 'comments', 'commenti']
const NATURAL = ['id', 'code', 'codice', 'cod', 'cf', 'ssn', 'matricola', 'targa', 'isbn', 'iban', 'sku', 'barcode', 'passport', 'passaporto', 'vat', 'piva', 'serial', 'seriale', 'codice fiscale', 'partita iva', 'p iva', 'tax code']
const FK_WORDS = ['id', 'code', 'codice', 'cod', 'key', 'chiave', 'fk']
const WEAK = ['name', 'nome', 'surname', 'cognome', 'date', 'data', 'title', 'titolo', 'description', 'descrizione', 'city', 'citta', 'address', 'indirizzo', 'type', 'tipo', 'status', 'stato', 'year', 'anno']
const GENERIC = ['info', 'information', 'informazioni', 'informazione', 'dati', 'value', 'valore', 'details', 'detail', 'dettagli', 'dettaglio', 'misc', 'other', 'altro', 'varie', 'generic', 'generico', 'campo', 'field']
const TYPE = ['type', 'tipo', 'tipologia', 'category', 'categoria', 'kind', 'status', 'stato', 'class', 'classe']
const GENERIC_REL = ['has', 'have', 'ha', 'hanno', 'is', 'e', 'related', 'relation', 'relationship', 'relazione', 'associazione', 'link', 'collegamento', 'connected', 'relates', 'related to', 'is related to', 'associato', 'associata', 'rel', 'r']

const looksPlural = (name: string) => {
  const w = wordsOf(name).pop() ?? ''
  if (w.length < 4) return false
  if (w.endsWith('s')) return !/(ss|us|is|ics)$/.test(w)
  return w.endsWith('i') && !w.endsWith('si') && !w.endsWith('ni') // Italian plurals; -si/-ni skip tesi, analisi
}
const maxOf = (card: string) => card.split(',')[1]

export function checkHints(d: Diagram, on: Record<string, boolean>, t: Translate): Hint[] {
  const out: Hint[] = []
  const hint = (ruleId: string, nodeId: string, message: string) => {
    if (on[ruleId]) out.push({ id: `${ruleId}:${nodeId}:${out.length}`, ruleId, nodeId, message })
  }
  const q = (s: string) => `“${s.trim() || t('msg.unnamed')}”`
  const entityIds = new Set(d.entities.map(e => e.id))
  const childIds = new Set(d.generalizations.filter(g => g.parentId).flatMap(g => g.childIds))
  const inGeneralization = new Set(d.generalizations.flatMap(g => [g.parentId, ...g.childIds].filter(Boolean) as string[]))
  const linkCount = (id: string) => d.relationships.reduce((n, r) => n + r.links.filter(l => l.entityId === id).length, 0)

  // ---- attribute-level hints (entities and relationships) ----
  const attributeHints = (n: Entity | Relationship) => {
    const label = q(n.name)
    const named = n.attributes.filter(a => norm(a.name))
    const isEntity = n.kind === 'entity'
    for (const a of named) {
      const nm = q(a.name)
      if (isName(a.name, AGE) && !a.derived) {
        const birth = named.find(b => b !== a && hasWord(b.name, BIRTH))
        if (birth) hint('age', n.id, t('hmsg.age-derived', { name: label, attr: nm, other: q(birth.name) }))
        else hint('age', n.id, t('hmsg.age-alone', { name: label, attr: nm }))
      }
      if (!a.derived && !a.identifier && hasWord(a.name, TOTAL)) hint('total-derived', n.id, t('hmsg.total-derived', { name: label, attr: nm }))
      if (hasWord(a.name, FULL_NAME)) {
        const hasParts = named.some(b => isName(b.name, FIRST_NAME)) && named.some(b => isName(b.name, SURNAME))
        hint('full-name', n.id, t(hasParts ? 'hmsg.full-name.derived' : 'hmsg.full-name.split', { name: label, attr: nm }))
      }
      if (isName(a.name, ADDRESS)) hint('address-split', n.id, t('hmsg.address-split', { name: label, attr: nm }))
      if (a.card === '1,1' && !a.identifier && isName(a.name, MULTI)) hint('multivalued', n.id, t('hmsg.multivalued', { name: label, attr: nm }))
      if (a.card === '1,1' && !a.identifier && isName(a.name, OPTIONAL)) hint('optional-attr', n.id, t('hmsg.optional-attr', { name: label, attr: nm }))
      if (isName(a.name, GENERIC)) hint('generic-attr', n.id, t('hmsg.generic-attr', { name: label, attr: nm }))
      if (isEntity && isName(a.name, TYPE)) hint('type-attr', n.id, t('hmsg.type-attr', { name: label, attr: nm }))
      const ne = norm(n.name)
      const an = norm(a.name)
      if (isEntity && ne.length > 2 && an !== ne && ` ${an} `.includes(` ${ne} `)) hint('attr-has-entity', n.id, t('hmsg.attr-has-entity', { name: label, attr: nm }))
      if (isEntity && a.identifier && a.card !== '1,1') hint('key-card', n.id, t('hmsg.key-card', { name: label, attr: nm, card: a.card }))
    }
    // phone1, phone2, ... : one multivalued attribute
    const stems = new Map<string, number>()
    for (const a of named) {
      const m = /^(.*?)\s*\d+$/.exec(norm(a.name))
      if (m && m[1]) stems.set(m[1], (stems.get(m[1]) ?? 0) + 1)
    }
    for (const [stem, count] of stems) if (count >= 2) hint('numbered-attrs', n.id, t('hmsg.numbered-attrs', { name: label, attr: q(stem) }))
    if (n.attributes.length > 10) hint('many-attrs', n.id, t('hmsg.many-attrs', { name: label, n: n.attributes.length }))
  }

  // ---- entities ----
  const idsOf = (e: Entity) => e.attributes.filter(a => a.identifier)
  const hasIdentifyingLink = (e: Entity) => d.relationships.some(r => r.links.some(l => l.entityId === e.id && l.identifying))
  d.entities.forEach((e, i) => {
    const label = q(e.name)
    attributeHints(e)
    const keys = idsOf(e)
    const identified = keys.length > 0 || hasIdentifyingLink(e)
    if (!identified && !childIds.has(e.id)) {
      const cand = e.attributes.find(a => norm(a.name) && hasWord(a.name, NATURAL))
      if (cand) hint('natural-id', e.id, t('hmsg.natural-id', { name: label, attr: q(cand.name) }))
    }
    if (keys.length === 1 && !hasIdentifyingLink(e) && isName(keys[0]!.name, WEAK)) hint('weak-key-name', e.id, t('hmsg.weak-key-name', { name: label, attr: q(keys[0]!.name) }))
    if (keys.length >= 4) hint('key-too-many', e.id, t('hmsg.key-too-many', { name: label, n: keys.length }))
    if (norm(e.name) && looksPlural(e.name)) hint('entity-plural', e.id, t('hmsg.entity-plural', { name: label }))
    if (e.attributes.length <= 1 && linkCount(e.id) === 1 && !inGeneralization.has(e.id) && norm(e.name)) hint('tiny-entity', e.id, t('hmsg.tiny-entity', { name: label }))

    for (const a of e.attributes) {
      const an = norm(a.name)
      if (!an) continue
      for (const o of d.entities) {
        const on_ = norm(o.name)
        if (o.id === e.id || on_.length < 3) continue
        if (an === on_) hint('attr-is-entity', e.id, t('hmsg.attr-is-entity', { name: label, attr: q(a.name), other: q(o.name) }))
        else if (` ${an} `.includes(` ${on_} `) && hasWord(a.name, FK_WORDS)) hint('fk-attr', e.id, t('hmsg.fk-attr', { name: label, attr: q(a.name), other: q(o.name) }))
      }
    }
    // entities that share most attributes: a generalization candidate
    const mine = new Set(e.attributes.map(a => norm(a.name)).filter(Boolean))
    for (const o of d.entities.slice(i + 1)) {
      const shared = [...new Set(o.attributes.map(a => norm(a.name)))].filter(x => x && mine.has(x))
      if (shared.length >= 3 && !(childIds.has(e.id) && childIds.has(o.id))) hint('shared-attrs', e.id, t('hmsg.shared-attrs', { name: label, other: q(o.name), n: shared.length }))
    }
  })

  // ---- relationships ----
  const seenPairs = new Map<string, string>()
  for (const r of d.relationships) {
    const label = q(r.name)
    attributeHints(r)
    const ends = r.links.filter(l => entityIds.has(l.entityId))
    const nameOf = (id: string) => q(d.entities.find(e => e.id === id)?.name ?? '')
    if (ends.length >= 3) hint('rel-ternary', r.id, t('hmsg.rel-ternary', { name: label, n: ends.length }))
    if (ends.length === 2 && ends[0]!.entityId !== ends[1]!.entityId && maxOf(ends[0]!.card) === '1' && maxOf(ends[1]!.card) === '1') hint('rel-one-to-one', r.id, t('hmsg.rel-one-to-one', { name: label }))
    if (new Set(ends.map(l => l.entityId)).size < ends.length) hint('rel-recursive', r.id, t('hmsg.rel-recursive', { name: label }))
    if (ends.length === 2) {
      const key = ends.map(l => l.entityId).sort().join('|')
      const prev = seenPairs.get(key)
      if (prev && ends[0]!.entityId !== ends[1]!.entityId) hint('rel-parallel', r.id, t('hmsg.rel-parallel', { name: label, other: q(prev), a: nameOf(ends[0]!.entityId), b: nameOf(ends[1]!.entityId) }))
      else seenPairs.set(key, r.name)
    }
    if (r.attributes.some(a => a.identifier)) hint('rel-key', r.id, t('hmsg.rel-key', { name: label }))
    if (ends.length === 2 && r.attributes.length) {
      const one = ends.filter(l => maxOf(l.card) === '1')
      if (one.length === 1) hint('rel-attr-move', r.id, t('hmsg.rel-attr-move', { name: label, other: nameOf(one[0]!.entityId) }))
    }
    if (isName(r.name, GENERIC_REL)) hint('rel-generic-name', r.id, t('hmsg.rel-generic-name', { name: label }))
    const rn = norm(r.name)
    if (rn && d.entities.some(e => norm(e.name) === rn)) hint('rel-like-entity', r.id, t('hmsg.rel-like-entity', { name: label }))
  }

  // ---- generalizations ----
  for (const g of d.generalizations) {
    const parent = d.entities.find(e => e.id === g.parentId)
    const kids = g.childIds.map(id => d.entities.find(e => e.id === id)).filter(Boolean) as Entity[]
    const names = (e: Entity) => new Set(e.attributes.map(a => norm(a.name)).filter(Boolean))
    if (parent) {
      const up = names(parent)
      for (const c of kids) {
        for (const a of c.attributes) if (norm(a.name) && up.has(norm(a.name))) hint('gen-dup-attr', c.id, t('hmsg.gen-dup-attr', { name: q(c.name), attr: q(a.name), other: q(parent.name) }))
      }
    }
    if (kids.length >= 2) {
      const up = parent ? names(parent) : new Set<string>()
      const common = [...names(kids[0]!)].filter(x => !up.has(x) && kids.every(k => names(k).has(x)))
      for (const x of common) hint('gen-shared-attr', g.id, t('hmsg.gen-shared-attr', { attr: q(x), parent: q(parent?.name ?? '') }))
    }
    for (const c of kids) {
      if (!c.attributes.length && linkCount(c.id) === 0) hint('gen-bare-child', c.id, t('hmsg.gen-bare-child', { name: q(c.name) }))
    }
  }

  return out
}

