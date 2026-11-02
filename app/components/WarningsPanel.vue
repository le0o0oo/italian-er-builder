<script setup lang="ts">
const emit = defineEmits<{ focus: [id: string] }>()
const { enabled, rules, warnings, setEnabled, setRule } = useWarnings()
const { t } = useT()
const open = ref(false)
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="ghost" size="icon" class="relative" :title="t('warn.button')">
        <Icon name="lucide:triangle-alert" :class="enabled && warnings.length ? 'text-amber-500' : ''" />
        <span v-if="enabled && warnings.length" class="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] leading-4 font-semibold text-white">{{ warnings.length }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" class="w-96 space-y-3 p-3">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold">{{ t('warn.heading') }}</p>
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          {{ enabled ? t('warn.on') : t('warn.off') }} <Switch :model-value="enabled" @update:model-value="setEnabled($event === true)" />
        </label>
      </div>

      <div v-if="enabled" class="max-h-52 space-y-1 overflow-y-auto">
        <p v-if="!warnings.length" class="flex items-center gap-2 rounded-md bg-emerald-500/10 px-2 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          <Icon name="lucide:circle-check" /> {{ t('warn.none') }}
        </p>
        <button
          v-for="w in warnings"
          :key="w.id"
          class="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
          @click="emit('focus', w.nodeId)"
        >
          <Icon name="lucide:triangle-alert" class="mt-0.5 shrink-0 text-amber-500" /> <span>{{ w.message }}</span>
        </button>
      </div>
      <p v-else class="text-sm text-muted-foreground">{{ t('warn.disabled') }}</p>

      <Separator />
      <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{{ t('warn.rules') }}</p>
      <div class="max-h-60 space-y-2.5 overflow-y-auto pr-1">
        <div v-for="r in RULES" :key="r.id" class="flex items-start gap-3">
          <Switch class="mt-0.5" :model-value="rules[r.id]" :disabled="!enabled" @update:model-value="setRule(r.id, $event === true)" />
          <div class="min-w-0">
            <p class="text-sm leading-tight">{{ t(`rule.${r.id}`) }}</p>
            <p class="text-xs text-muted-foreground">{{ t(`rule.${r.id}.desc`) }}</p>
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
