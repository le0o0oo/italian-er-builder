export type Notation = 'italian' | 'crow'
export const NOTATIONS: { id: Notation, icon: string }[] = [
  { id: 'italian', icon: 'lucide:triangle' },
  { id: 'crow', icon: 'lucide:git-fork' },
]

/** Drawing notation currently in use. Module-level so geometry and layout helpers can read it reactively. */
export const notation = ref<Notation>('italian')
/** Crow's foot: entity id -> names of the relationships that (partly) identify it, shown as `PK` rows. Kept up to date by useDiagram. */
export const identifyingRows = ref<Record<string, string[]>>({})
export const isCrow = () => notation.value === 'crow'
