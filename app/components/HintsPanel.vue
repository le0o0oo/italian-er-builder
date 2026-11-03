<script setup lang="ts">
const emit = defineEmits<{ focus: [id: string] }>()
const { enabled, rules, hints, setEnabled, setRule, setRules } = useHints()
const { t } = useT()
const open = ref(false)
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="ghost" size="icon" class="relative" :title="t('hint.button')">
        <Icon name="lucide:lightbulb" :class="enabled && hints.length ? 'text-sky-500' : ''" />
        <span v-if="enabled && hints.length" class="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] leading-4 font-semibold text-white">{{ hints.length }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" class="w-[min(24rem,calc(100vw-1.5rem))] space-y-3 p-3">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold">{{ t('hint.heading') }}</p>
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          {{ enabled ? t('warn.on') : t('warn.off') }} <Switch :model-value="enabled" @update:model-value="setEnabled($event === true)" />
        </label>
      </div>

      <div v-if="enabled" class="max-h-60 space-y-1 overflow-x-hidden overflow-y-auto">
        <p v-if="!hints.length" class="flex items-center gap-2 rounded-md bg-emerald-500/10 px-2 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          <Icon name="lucide:circle-check" /> {{ t('hint.none') }}
        </p>
        <button
          v-for="h in hints"
          :key="h.id"
          class="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
          @click="emit('focus', h.nodeId); open = false"
        >
          <Icon name="lucide:lightbulb" class="mt-0.5 shrink-0 text-sky-500" /> <span>{{ h.message }}</span>
        </button>
      </div>
      <p v-else class="text-sm text-muted-foreground">{{ t('hint.disabled') }}</p>

      <Separator />
      <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{{ t('hint.types') }}</p>
      <div class="max-h-72 space-y-1 overflow-x-hidden overflow-y-auto pr-1">
        <Collapsible v-for="g in HINT_GROUPS" :key="g.id" v-slot="{ open: expanded }" class="rounded-md">
          <div class="flex items-center gap-2 py-1">
            <CollapsibleTrigger class="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-medium">
              <Icon name="lucide:chevron-right" class="size-4 shrink-0 text-muted-foreground transition-transform" :class="expanded ? 'rotate-90' : ''" />
              <span class="truncate">{{ t(`hint.group.${g.id}`) }}</span>
              <span class="text-xs font-normal text-muted-foreground">{{ g.rules.filter(id => rules[id]).length }}/{{ g.rules.length }}</span>
            </CollapsibleTrigger>
            <Switch :model-value="g.rules.some(id => rules[id])" :disabled="!enabled" @update:model-value="setRules(g.rules, $event === true)" />
          </div>
          <CollapsibleContent>
            <div class="mb-2 ml-2 space-y-2.5 border-l pt-1 pl-3">
              <div v-for="id in g.rules" :key="id" class="flex items-start gap-3">
                <Switch class="mt-0.5" :model-value="rules[id]" :disabled="!enabled" @update:model-value="setRule(id, $event === true)" />
                <div class="min-w-0">
                  <p class="text-sm leading-tight">{{ t(`hint.${id}`) }}</p>
                  <p class="text-xs text-muted-foreground">{{ t(`hint.${id}.desc`) }}</p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </PopoverContent>
  </Popover>
</template>
