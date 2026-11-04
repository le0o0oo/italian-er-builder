<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const { bindings, setBinding, reset } = useShortcuts()
const { t } = useT()
const capturing = ref<string | null>(null)
const groups = ['node', 'diagram'] as const

function onKey(ev: KeyboardEvent, id: string) {
  ev.preventDefault()
  ev.stopPropagation()
  if (ev.key === 'Escape') { capturing.value = null; return }
  const combo = eventCombo(ev)
  if (!combo) return
  setBinding(id, combo)
  capturing.value = null
}
watch(open, v => { if (!v) capturing.value = null })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[85dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('sc.title') }}</DialogTitle>
        <DialogDescription>{{ t('sc.desc') }}</DialogDescription>
      </DialogHeader>
      <div v-for="g in groups" :key="g" class="space-y-1">
        <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{{ t(`sc.group.${g}`) }}</p>
        <div v-for="s in SHORTCUTS.filter(x => x.group === g)" :key="s.id" class="flex items-center justify-between gap-2 py-0.5">
          <span class="text-sm">{{ t(`shortcut.${s.id}`) }}</span>
          <div class="flex items-center gap-1">
            <Button
              size="sm"
              :variant="capturing === s.id ? 'default' : 'outline'"
              class="min-w-24 font-mono"
              @click="capturing = s.id"
              @keydown="capturing === s.id && onKey($event, s.id)"
              @blur="capturing === s.id && (capturing = null)"
            >
              {{ capturing === s.id ? t('sc.pressKeys') : bindings[s.id] ? formatCombo(bindings[s.id]!) : t('sc.unbound') }}
            </Button>
            <Button size="icon-sm" variant="ghost" :title="t('sc.unbind')" :disabled="!bindings[s.id]" @click="setBinding(s.id, '')"><Icon name="lucide:x" /></Button>
          </div>
        </div>
      </div>
      <Button variant="outline" size="sm" class="self-start" @click="reset"><Icon name="lucide:rotate-ccw" /> {{ t('sc.reset') }}</Button>
    </DialogContent>
  </Dialog>
</template>
