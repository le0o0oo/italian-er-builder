<script setup lang="ts">
/** Crow's foot style box: name header and, below it, one row per attribute. Entities are square, relationships rounded. */
import type { Entity, Relationship } from '~/types/er'

const props = defineProps<{ node: Entity | Relationship }>()
const c = useErColors()
const size = computed(() => nodeSize(props.node))
const isEntity = computed(() => props.node.kind === 'entity')
/** relationships that take part in this entity's identifier: listed as `PK` rows above the attributes */
const idRels = computed(() => (isEntity.value ? (identifyingRows.value[props.node.id] ?? []) : []))
const dependent = computed(() => idRels.value.length > 0)
const hasPk = computed(() => props.node.attributes.some(a => a.identifier) || dependent.value)
const top = computed(() => -size.value.h / 2)
const rowY = (i: number) => top.value + CROW_HEAD + 4 + 11 + i * CROW_ROW
</script>

<template>
  <g>
    <rect :x="-size.w / 2" :y="top" :width="size.w" :height="size.h" :rx="isEntity ? (dependent ? 12 : 3) : 14" :fill="c.paper" :stroke="c.ink" stroke-width="2" />
    <rect v-if="isEntity" :x="-size.w / 2 + 1" :y="top + 1" :width="size.w - 2" :height="CROW_HEAD - 1" :rx="dependent ? 11 : 2" :fill="c.ink" fill-opacity="0.08" />
    <text :y="top + CROW_HEAD / 2 + (node.attributes.length || isEntity ? 0 : 0)" :style="{ fontStyle: isEntity ? 'normal' : 'italic' }" text-anchor="middle" dominant-baseline="central" :font-size="isEntity ? 15 : 14" :font-weight="isEntity ? 700 : 600" :fill="c.ink">{{ node.name }}</text>
    <template v-if="node.attributes.length || idRels.length">
      <line :x1="-size.w / 2" :x2="size.w / 2" :y1="top + CROW_HEAD" :y2="top + CROW_HEAD" :stroke="c.ink" stroke-width="1.5" />
      <g v-for="(r, i) in idRels" :key="`id-${i}`">
        <text :x="-size.w / 2 + 10" :y="rowY(i)" dominant-baseline="central" font-size="10" font-weight="700" :fill="c.muted">PK</text>
        <text :x="-size.w / 2 + 36" :y="rowY(i)" dominant-baseline="central" font-size="13" font-weight="700" font-style="italic" :fill="c.ink">↳ {{ r }}</text>
      </g>
      <g v-for="(a, j) in node.attributes" :key="a.id">
        <text v-if="a.identifier" :x="-size.w / 2 + 10" :y="rowY(idRels.length + j)" dominant-baseline="central" font-size="10" font-weight="700" :fill="c.muted">PK</text>
        <text :x="-size.w / 2 + 10 + (hasPk ? 26 : 0)" :y="rowY(idRels.length + j)" dominant-baseline="central" font-size="13" :font-weight="a.identifier ? 700 : 400" :font-style="a.derived ? 'italic' : 'normal'" :text-decoration="a.identifier ? 'underline' : undefined" :fill="c.ink">
          {{ a.name }}<tspan v-if="a.card !== '1,1'" :fill="c.muted" font-weight="400"> ({{ a.card }})</tspan>
        </text>
      </g>
    </template>
  </g>
</template>
