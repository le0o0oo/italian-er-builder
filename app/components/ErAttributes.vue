<script setup lang="ts">
import type { Attribute } from '~/types/er'

const props = defineProps<{ attributes: Attribute[], spineX: number, startY: number, dir?: 1 | -1, keyLine?: boolean, flip?: boolean }>()
const f = computed(() => props.flip ? -1 : 1)
const d = computed(() => props.dir ?? 1)
const yAt = (i: number) => props.startY + d.value * (12 + i * 24)
const c = useErColors()
</script>

<template>
  <g v-if="attributes.length">
    <line :x1="spineX" :y1="startY" :x2="spineX" :y2="yAt(attributes.length - 1)" :stroke="c.ink" stroke-width="1.5" />
    <g v-for="(a, i) in attributes" :key="a.id">
      <line :x1="spineX" :x2="spineX + f * 22" :y1="yAt(i)" :y2="yAt(i)" :stroke="c.ink" stroke-width="1.5" :stroke-dasharray="a.derived ? '4 3' : undefined" />
      <circle :cx="spineX + f * 27" :cy="yAt(i)" r="5" :fill="a.identifier && !keyLine ? c.ink : c.paper" :stroke="c.ink" stroke-width="1.5" :stroke-dasharray="a.derived ? '3 2' : undefined" />
      <text :x="spineX + f * 38" :text-anchor="flip ? 'end' : 'start'" :y="yAt(i)" dominant-baseline="central" font-size="13" :fill="c.ink" :stroke="c.paper" stroke-width="5" stroke-linejoin="round" paint-order="stroke">
        {{ a.name }}<tspan v-if="a.card !== '1,1'" :fill="c.muted"> ({{ a.card }})</tspan>
      </text>
    </g>
  </g>
</template>
