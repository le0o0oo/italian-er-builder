export interface ShortcutDef {
  id: string
  group: 'node' | 'diagram'
  default: string
}

export const SHORTCUTS: ShortcutDef[] = [
  { id: 'rename', group: 'node', default: 'r' },
  { id: 'addAttribute', group: 'node', default: 'a' },
  { id: 'connect', group: 'node', default: 'c' },
  { id: 'addGeneralization', group: 'node', default: 'g' },
  { id: 'duplicate', group: 'node', default: 'ctrl+d' },
  { id: 'delete', group: 'node', default: 'delete' },
  { id: 'search', group: 'diagram', default: 'ctrl+f' },
  { id: 'newEntity', group: 'diagram', default: 'e' },
  { id: 'newRelationship', group: 'diagram', default: 'l' },
  { id: 'newGeneralization', group: 'diagram', default: 'shift+g' },
  { id: 'arrange', group: 'diagram', default: 't' },
  { id: 'toggleAuto', group: 'diagram', default: 'shift+t' },
  { id: 'fit', group: 'diagram', default: 'f' },
  { id: 'undo', group: 'diagram', default: 'ctrl+z' },
  { id: 'redo', group: 'diagram', default: 'ctrl+shift+z' },
]

const STORAGE_KEY = 'er-maker:shortcuts'
const defaults = () => Object.fromEntries(SHORTCUTS.map(s => [s.id, s.default]))

/** Normalised combo for a key event, e.g. "ctrl+shift+z"; null for bare modifier presses. */
export function eventCombo(ev: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta', 'Dead'].includes(ev.key)) return null
  const key = ev.key === ' ' ? 'space' : ev.key.toLowerCase()
  const parts: string[] = []
  if (ev.ctrlKey || ev.metaKey) parts.push('ctrl')
  if (ev.altKey) parts.push('alt')
  if (ev.shiftKey) parts.push('shift')
  parts.push(key)
  return parts.join('+')
}

export function formatCombo(combo: string) {
  if (!combo) return 'Unbound'
  return combo.split('+').map((p) => {
    if (p === 'delete') return 'Del'
    if (p === 'escape') return 'Esc'
    return p.length === 1 ? p.toUpperCase() : p[0]!.toUpperCase() + p.slice(1)
  }).join('+')
}

export function useShortcuts() {
  const bindings = useState<Record<string, string>>('er-shortcuts', defaults)

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) bindings.value = { ...defaults(), ...JSON.parse(raw) }
    }
    catch { /* ignore */ }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings.value)) }
    catch { /* ignore */ }
  }
  /** Binds a combo to an action; an action that already used it becomes unbound. */
  function setBinding(id: string, combo: string) {
    const next = { ...bindings.value }
    if (combo) for (const k of Object.keys(next)) if (next[k] === combo) next[k] = ''
    next[id] = combo
    bindings.value = next
    save()
  }
  function reset() {
    bindings.value = defaults()
    save()
  }
  /** Id of the action bound to this event, if any. */
  function match(ev: KeyboardEvent): string | null {
    const combo = eventCombo(ev)
    if (!combo) return null
    return Object.keys(bindings.value).find(id => bindings.value[id] === combo) ?? null
  }
  /** Display label for an action's key, '' when unbound. */
  const label = (id: string) => (bindings.value[id] ? formatCombo(bindings.value[id]!) : '')

  return { bindings, load, setBinding, reset, match, label }
}
