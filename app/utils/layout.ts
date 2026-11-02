import type { Diagram } from '~/types/er'

export type LayoutStrategy = 'organic' | 'organic-smart' | 'layered' | 'radial' | 'circular' | 'grid'

export const LAYOUT_STRATEGIES: { id: LayoutStrategy }[] = [
  { id: 'organic' }, { id: 'organic-smart' }, { id: 'layered' }, { id: 'radial' }, { id: 'circular' }, { id: 'grid' },
]

export function computeLayout(d: Diagram, strategy: LayoutStrategy = 'organic') {
  switch (strategy) {
    case 'layered': return computeLayeredLayout(d)
    case 'radial': return computeRadialLayout(d)
    case 'circular': return computeCircularLayout(d)
    case 'grid': return computeGridLayout(d)
    case 'organic-smart': return computeForceLayout(d, true)
    default: return computeForceLayout(d, false)
  }
}
