import type { Warning } from '~/utils/rules'

const STORAGE_KEY = 'er-maker:rules'

export function useWarnings() {
  const { diagram } = useDiagram()
  const enabled = useState('er-warn-on', () => true)
  const rules = useState<Record<string, boolean>>('er-warn-rules', defaultRules)

  const warnings = computed(() => (enabled.value ? checkDiagram(diagram.value, rules.value) : []))
  const byNode = computed(() => {
    const m: Record<string, Warning[]> = {}
    for (const w of warnings.value) (m[w.nodeId] ??= []).push(w)
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
      rules.value = { ...defaultRules(), ...v.rules }
    }
    catch { /* ignore */ }
  }
  const setEnabled = (v: boolean) => { enabled.value = v; save() }
  const setRule = (id: string, v: boolean) => { rules.value = { ...rules.value, [id]: v }; save() }

  return { enabled, rules, warnings, byNode, load, setEnabled, setRule }
}
