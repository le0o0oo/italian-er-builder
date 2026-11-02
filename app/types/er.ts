export type Card = '0,1' | '1,1' | '0,N' | '1,N'

export interface Attribute {
  id: string
  name: string
  /** Filled circle: part of the identifier. */
  identifier: boolean
  /** Shown only when different from the implicit (1,1). */
  card: Card
}

export interface Entity {
  id: string
  kind: 'entity'
  name: string
  x: number
  y: number
  attributes: Attribute[]
}

export interface Link {
  id: string
  entityId: string
  card: Card
  /** External identifier: filled dot on the entity end of the line. */
  identifying: boolean
}

export interface Relationship {
  id: string
  kind: 'relationship'
  name: string
  x: number
  y: number
  attributes: Attribute[]
  links: Link[]
}

export interface Generalization {
  id: string
  kind: 'generalization'
  x: number
  y: number
  parentId: string | null
  childIds: string[]
  /** Total = filled arrow, partial = empty arrow. */
  total: boolean
  /** Exclusive (e) vs overlapping/sovrapposta (s). Missing in old saves = exclusive. */
  exclusive: boolean
}

export type DiagramNode = Entity | Relationship | Generalization

export interface Diagram {
  entities: Entity[]
  relationships: Relationship[]
  generalizations: Generalization[]
}
