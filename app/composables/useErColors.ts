export const ER_LIGHT = { ink: '#111111', paper: '#ffffff', muted: '#555555', grid: '#d4d4d8', sel: '#2563eb', warn: '#f59e0b' }
export const ER_DARK = { ink: '#ececec', paper: '#18181b', muted: '#a1a1aa', grid: '#3f3f46', sel: '#60a5fa', warn: '#fbbf24' }

/** Diagram palette following the current colour mode. */
export function useErColors() {
  const mode = useColorMode()
  return computed(() => (mode.value === 'dark' ? ER_DARK : ER_LIGHT))
}
