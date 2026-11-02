export interface ShortcutDef {
  id: string
  label: string
  group: 'Selected element' | 'Diagram'
  default: string
}

export const SHORTCUTS: ShortcutDef[] = [
  { id: 'rename', label: 'Rename', group: 'Selected element', default: 'r' },
  { id: 'addAttribute', label: 'Add attribute', group: 'Selected element', default: 'a' },
  { id: 'connect', label: 'Connect to…', group: 'Selected element', default: 'c' },
  { id: 'addGeneralization', label: 'Add generalization (entity)', group: 'Selected element', default: 'g' },
  { id: 'duplicate', label: 'Duplicate', group: 'Selected element', default: 'ctrl+d' },
  { id: 'delete', label: 'Delete', group: 'Selected element', default: 'delete' },
  { id: 'newEntity', label: 'New entity', group: 'Diagram', default: 'e' },
  { id: 'newRelationship', label: 'New relationship', group: 'Diagram', default: 'l' },
  { id: 'newGeneralization', label: 'New generalization', group: 'Diagram', default: 'shift+g' },
  { id: 'arrange', label: 'Arrange once', group: 'Diagram', default: 't' },
  { id: 'toggleAuto', label: 'Toggle auto layout', group: 'Diagram', default: 'shift+t' },
  { id: 'fit', label: 'Fit diagram', group: 'Diagram', default: 'f' },
  { id: 'undo', label: 'Undo', group: 'Diagram', default: 'ctrl+z' },
  { id: 'redo', label: 'Redo', group: 'Diagram', default: 'ctrl+shift+z' },
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
