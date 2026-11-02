<script setup lang="ts">
defineProps<{ text: string, shortcut?: string, side?: 'top' | 'bottom' | 'left' | 'right' }>()
const { label } = useShortcuts()
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child><slot /></TooltipTrigger>
    <TooltipContent :side="side ?? 'bottom'">
      {{ text }}
      <kbd v-if="shortcut && label(shortcut)" class="ml-1.5 rounded bg-background/20 px-1 py-0.5 font-mono text-[10px]">{{ label(shortcut) }}</kbd>
    </TooltipContent>
  </Tooltip>
</template>
