import type { Hint } from '~/utils/hints'

const STORAGE_KEY = 'er-maker:hints'

export function useHints() {
  const { diagram } = useDiagram()
  const { t } = useT()
  const enabled = useState('er-hints-on', () => true)
  const rules = useState<Record<string, boolean>>('er-hints-rules', defaultHints)

  const hints = computed(() => (enabled.value ? checkHints(diagram.value, rules.value, t) : []))
  const byNode = computed(() => {
    const m: Record<string, Hint[]> = {}
    for (const h of hints.value) (m[h.nodeId] ??= []).push(h)
    return m
  })

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: enabled.value, rules: rules.value })) }
    catch { /* storage unavailable */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const v = JSON.parse(raw)
      enabled.value = v.enabled !== false
      rules.value = { ...defaultHints(), ...v.rules }
    }
    catch { /* ignore */ }
  }
  const setEnabled = (v: boolean) => { enabled.value = v; save() }
  const setRule = (id: string, v: boolean) => { rules.value = { ...rules.value, [id]: v }; save() }

  const setRules = (ids: string[], v: boolean) => { rules.value = { ...rules.value, ...Object.fromEntries(ids.map(id => [id, v])) }; save() }

  return { enabled, rules, hints, byNode, load, setEnabled, setRule, setRules }
}
