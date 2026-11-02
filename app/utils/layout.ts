import type { Diagram } from '~/types/er'

export type LayoutStrategy = 'organic' | 'layered' | 'radial' | 'circular' | 'grid'

export const LAYOUT_STRATEGIES: { id: LayoutStrategy, label: string, hint: string }[] = [
  { id: 'organic', label: 'Organic', hint: 'Force-directed: connected nodes pull together' },
  { id: 'layered', label: 'Layered', hint: 'Rows by distance from the main entity' },
  { id: 'radial', label: 'Radial', hint: 'Rings around the main entity' },
  { id: 'circular', label: 'Circular', hint: 'Everything on a single circle' },
  { id: 'grid', label: 'Grid', hint: 'Compact even grid' },
]

export function computeLayout(d: Diagram, strategy: LayoutStrategy = 'organic') {
  switch (strategy) {
    case 'layered': return computeLayeredLayout(d)
    case 'radial': return computeRadialLayout(d)
    case 'circular': return computeCircularLayout(d)
    case 'grid': return computeGridLayout(d)
    default: return computeForceLayout(d)
  }
}
