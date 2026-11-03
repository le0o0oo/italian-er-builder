<script setup lang="ts">
/** Tiny static example of "Employee (1,1) – works in – (0,N) Department" drawn in the given notation. */
import type { Notation } from '~/utils/notation'

defineProps<{ kind: Notation }>()
const { t } = useT()
</script>

<template>
  <svg viewBox="0 0 280 100" class="w-full rounded-md border bg-muted/40 text-foreground" aria-hidden="true" font-family="Arial, Helvetica, sans-serif">
    <!-- Italian notation: rectangles, diamond, attribute circles, (min,max) -->
    <g v-if="kind === 'italian'">
      <g class="stroke-foreground" stroke-width="1.5" fill="none">
        <line x1="76" y1="62" x2="106" y2="62" /><line x1="174" y1="62" x2="204" y2="62" />
        <line x1="26" y1="49" x2="26" y2="30" />
      </g>
      <circle cx="26" cy="25" r="5" class="fill-foreground stroke-foreground" stroke-width="1.5" />
      <text x="36" y="28" font-size="10" class="fill-foreground">id</text>
      <rect x="6" y="49" width="70" height="26" class="fill-background stroke-foreground" stroke-width="2" />
      <text x="41" y="62" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700" class="fill-foreground">{{ t('sample.emp') }}</text>
      <polygon points="140,40 174,62 140,84 106,62" class="fill-background stroke-foreground" stroke-width="2" stroke-linejoin="round" />
      <text x="140" y="62" text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="600" class="fill-foreground">{{ t('notation.demoRel') }}</text>
      <rect x="204" y="49" width="70" height="26" class="fill-background stroke-foreground" stroke-width="2" />
      <text x="239" y="62" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700" class="fill-foreground">{{ t('sample.dep') }}</text>
      <text x="91" y="55" text-anchor="middle" font-size="8.5" font-weight="600" class="fill-foreground">(1,1)</text>
      <text x="189" y="55" text-anchor="middle" font-size="8.5" font-weight="600" class="fill-foreground">(0,N)</text>
    </g>

    <!-- Crow's foot: boxes with attribute rows, dashed line, end symbols -->
    <g v-else>
      <g class="stroke-foreground" stroke-width="1.5" fill="none">
        <line x1="76" y1="50" x2="112" y2="50" stroke-dasharray="6 4" /><line x1="168" y1="50" x2="204" y2="50" stroke-dasharray="6 4" />
        <!-- Employee end: many + optional (card of Department link: 0,N) -->
        <path d="M89 50L76 43M89 50L76 50M89 50L76 57" stroke-linecap="round" />
        <circle cx="97" cy="50" r="4" class="fill-background" />
        <!-- Department end: exactly one (card of Employee link: 1,1) -->
        <path d="M198 43V57M190 43V57" stroke-linecap="round" />
      </g>
      <rect x="6" y="25" width="70" height="50" rx="3" class="fill-background stroke-foreground" stroke-width="2" />
      <rect x="7" y="26" width="68" height="17" rx="2" class="fill-foreground" fill-opacity="0.08" />
      <line x1="6" y1="43" x2="76" y2="43" class="stroke-foreground" stroke-width="1.5" />
      <text x="41" y="35" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700" class="fill-foreground">{{ t('sample.emp') }}</text>
      <text x="12" y="59" dominant-baseline="central" font-size="7" font-weight="700" class="fill-muted-foreground">PK</text>
      <text x="26" y="59" dominant-baseline="central" font-size="9" font-weight="700" text-decoration="underline" class="fill-foreground">id</text>
      <rect x="112" y="41" width="56" height="18" rx="9" class="fill-background stroke-foreground" stroke-width="2" />
      <text x="140" y="50" text-anchor="middle" dominant-baseline="central" font-size="8" font-style="italic" font-weight="600" class="fill-foreground">{{ t('notation.demoRel') }}</text>
      <rect x="204" y="25" width="70" height="50" rx="3" class="fill-background stroke-foreground" stroke-width="2" />
      <rect x="205" y="26" width="68" height="17" rx="2" class="fill-foreground" fill-opacity="0.08" />
      <line x1="204" y1="43" x2="274" y2="43" class="stroke-foreground" stroke-width="1.5" />
      <text x="239" y="35" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700" class="fill-foreground">{{ t('sample.dep') }}</text>
      <text x="210" y="59" dominant-baseline="central" font-size="7" font-weight="700" class="fill-muted-foreground">PK</text>
      <text x="224" y="59" dominant-baseline="central" font-size="9" font-weight="700" text-decoration="underline" class="fill-foreground">id</text>
    </g>
  </svg>
</template>
