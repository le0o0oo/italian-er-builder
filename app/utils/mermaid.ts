import type { Card, Diagram } from '~/types/er'

// Mermaid reads the symbol next to an entity as "how many of THIS entity per one of the other",
// i.e. the participation of the *other* entity — hence the swap in `link` below.
const LEFT: Record<Card, string> = { '1,1': '||', '0,1': '|o', '0,N': '}o', '1,N': '}|' }
const RIGHT: Record<Card, string> = { '1,1': '||', '0,1': 'o|', '0,N': 'o{', '1,N': '|{' }

const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
const quote = (s: string) => `"${s.replace(/"/g, '\'')}"`

/** Mermaid `erDiagram` source. Relationships with attributes (or not exactly two ends) become associative entities. */
export function toMermaid(d: Diagram): string {
  const used = new Set<string>()
  const unique = (label: string, prefix: string) => {
    let base = ascii(label) || prefix
    if (/^\d/.test(base)) base = `${prefix}_${base}`
    let name = base
    for (let i = 2; used.has(name); i++) name = `${base}_${i}`
    used.add(name)
    return name
  }
  const names = new Map<string, string>()
  for (const e of d.entities) names.set(e.id, unique(e.name, 'Entity'))
  for (const r of d.relationships) names.set(r.id, unique(r.name, 'Relationship'))

  const attrLines = (attrs: { name: string, identifier: boolean, card: Card }[], isEntity: boolean) => {
    const seen = new Set<string>()
    return attrs.map((a) => {
      let base = ascii(a.name) || 'attribute'
      if (/^\d/.test(base)) base = `a_${base}`
      let name = base
      for (let i = 2; seen.has(name); i++) name = `${base}_${i}`
      seen.add(name)
      const note = a.card === '1,1' ? '' : ` ${quote(`(${a.card})`)}`
      return `        string ${name}${isEntity && a.identifier ? ' PK' : ''}${note}`
    })
  }

  const blocks: string[] = []
  const rels: string[] = []
  const block = (name: string, attrs: string[]) =>
    blocks.push(attrs.length ? `    ${name} {\n${attrs.join('\n')}\n    }` : `    ${name}`)

  for (const e of d.entities) block(names.get(e.id)!, attrLines(e.attributes, true))

  for (const r of d.relationships) {
    const links = r.links.filter(l => names.has(l.entityId))
    if (links.length === 2 && !r.attributes.length) {
      const [a, b] = links as [typeof links[0], typeof links[0]]
      rels.push(`    ${names.get(a.entityId)} ${LEFT[b.card]}--${RIGHT[a.card]} ${names.get(b.entityId)} : ${quote(r.name)}`)
    }
    else {
      block(names.get(r.id)!, attrLines(r.attributes, false))
      for (const l of links) rels.push(`    ${names.get(l.entityId)} ||--${RIGHT[l.card]} ${names.get(r.id)} : ${quote('involves')}`)
    }
  }

  const gens: string[] = []
  for (const g of d.generalizations) {
    if (!g.parentId || !names.has(g.parentId)) continue
    const tag = `(${g.total ? 't' : 'p'},${g.exclusive === false ? 's' : 'e'})`
    for (const c of g.childIds) if (names.has(c)) gens.push(`    ${names.get(g.parentId)} ||--o| ${names.get(c)} : ${quote(`is a ${tag}`)}`)
  }

  return ['erDiagram', ...blocks, ...rels, ...(gens.length ? ['    %% generalizations (t/p = total/partial, e/s = exclusive/overlapping)', ...gens] : [])].join('\n') + '\n'
}
