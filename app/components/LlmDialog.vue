<script setup lang="ts">
import type { Diagram } from '~/types/er'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ import: [d: Diagram] }>()
const { t } = useT()
const text = ref('')
const error = ref('')
const copied = ref(false)

watch(open, (v) => { if (v) { text.value = ''; error.value = ''; copied.value = false } })

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(LLM_PROMPT)
    copied.value = true
  }
  catch { error.value = t('notice.clipboardFail') }
}
function doImport() {
  try {
    emit('import', parseDiagram(text.value))
    open.value = false
  }
  catch { error.value = t('llm.invalid') }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[85dvh] max-w-max overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ t('llm.title') }}</DialogTitle>
        <DialogDescription>{{ t('llm.desc') }}</DialogDescription>
      </DialogHeader>
      <div class="space-y-2">
        <p class="text-sm font-medium">{{ t('llm.step1') }}</p>
        <Button variant="outline" class="w-full" @click="copyPrompt">
          <Icon :name="copied ? 'lucide:check' : 'lucide:clipboard-copy'" /> {{ copied ? t('llm.copied') : t('llm.copy') }}
        </Button>
        <p class="text-xs text-muted-foreground">{{ t('llm.step1hint') }}</p>
      </div>
      <div class="space-y-2">
        <p class="text-sm font-medium">{{ t('llm.step2') }}</p>
        <Textarea v-model="text" class="h-40 font-mono text-xs" :placeholder="t('llm.placeholder')" @input="error = ''" />
        <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
      </div>
      <DialogFooter>
        <Button :disabled="!text.trim()" @click="doImport"><Icon name="lucide:wand-sparkles" /> {{ t('llm.import') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
