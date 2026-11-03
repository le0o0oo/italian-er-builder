import type { Notation } from '~/utils/notation'

const STORAGE_KEY = 'er-maker:notation'

export function useNotation() {
  function set(n: Notation) {
    notation.value = n
    try { localStorage.setItem(STORAGE_KEY, n) }
    catch { /* storage unavailable */ }
  }
  function load() {
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (NOTATIONS.some(x => x.id === v)) notation.value = v as Notation
    }
    catch { /* storage unavailable */ }
  }
  return { notation, set, load }
}
