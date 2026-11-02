<script setup lang="ts">
import type { Diagram } from '~/types/er'

const colorMode = useColorMode()
const { diagram, selectedId, mode, pendingId, isEmpty, find, setMode, addEntity, addRelationship, addGeneralization, remove, load, init, undo, redo, canUndo, canRedo, duplicate, addAttribute, addGeneralizationFor, autoLayout, setAutoLayout, runLayout, fitRequest } = useDiagram()
const canvas = ref<{ center: () => { x: number, y: number }, fit: () => void, zoom: (f: number) => void, exportSvg: () => { width: number, height: number, markup: string } }>()
const fileInput = ref<HTMLInputElement>()

onMounted(() => { init(); shortcuts.load() })
watch(fitRequest, () => nextTick(() => canvas.value?.fit()))

function addAt(fn: (x: number, y: number) => void) {
  setMode('select')
  const c = canvas.value!.center()
  const j = () => (Math.random() - 0.5) * 120
  fn(c.x + j(), c.y + j())
}

function download(name: string, blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const exportJson = () => download('diagram.json', new Blob([JSON.stringify(diagram.value, null, 2)], { type: 'application/json' }))
const exportSvg = () => download('diagram.svg', new Blob([canvas.value!.exportSvg().markup], { type: 'image/svg+xml' }))
function exportPng() {
  const { width, height, markup } = canvas.value!.exportSvg()
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = width * 2
    c.height = height * 2
    const ctx = c.getContext('2d')!
    ctx.scale(2, 2)
    ctx.drawImage(img, 0, 0, width, height)
    c.toBlob(b => b && download('diagram.png', b))
  }
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
}

async function onImport(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  ;(ev.target as HTMLInputElement).value = ''
  if (!file) return
  try {
    const d = JSON.parse(await file.text()) as Diagram
    if (!Array.isArray(d.entities) || !Array.isArray(d.relationships) || !Array.isArray(d.generalizations)) throw new Error('bad shape')
    load(d)
    nextTick(() => canvas.value?.fit())
  }
  catch { alert('This file is not a valid ER diagram.') }
}

function loadSample() {
  load(sampleDiagram())
  nextTick(() => canvas.value?.fit())
}
function clearAll() {
  if (isEmpty.value || confirm('Delete the whole diagram?')) {
    load(emptyDiagram())
    nextTick(() => canvas.value?.fit())
  }
}

const shortcuts = useShortcuts()
const shortcutsOpen = ref(false)

function onKey(ev: KeyboardEvent) {
  const t = ev.target as HTMLElement
  if (t.closest('input, textarea, [role=combobox], [role=dialog], [contenteditable]')) return
  if (ev.key === 'Escape') { setMode('select'); selectedId.value = null; return }
  let id = shortcuts.match(ev)
  if (!id && ev.key === 'Backspace') id = 'delete'
  if (!id && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') id = 'redo'
  if (!id) return
  const sel = find(selectedId.value)
  const named = sel?.kind === 'entity' || sel?.kind === 'relationship' ? sel : undefined
  const needsNode = ['rename', 'addAttribute', 'duplicate'].includes(id)
  if (needsNode && !named) return
  if (id === 'connect' && !sel) return
  if (id === 'addGeneralization' && sel?.kind !== 'entity') return
  if (id === 'delete' && !sel) return
  ev.preventDefault()
  switch (id) {
    case 'rename': setTimeout(() => { const el = document.getElementById('name') as HTMLInputElement | null; el?.focus(); el?.select() }, 0); break
    case 'addAttribute': addAttribute(named!); break
    case 'connect': mode.value = 'link'; pendingId.value = sel!.id; break
    case 'addGeneralization': addGeneralizationFor(sel!.id); break
    case 'duplicate': duplicate(sel!.id); break
    case 'delete': remove(sel!.id); break
    case 'newEntity': addAt(addEntity); break
    case 'newRelationship': addAt(addRelationship); break
    case 'newGeneralization': addAt(addGeneralization); break
    case 'arrange': runLayout({ fit: true }); break
    case 'toggleAuto': setAutoLayout(!autoLayout.value); break
    case 'fit': canvas.value?.fit(); break
    case 'undo': undo(); break
    case 'redo': redo(); break
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

const { label: keyLabel } = useShortcuts()
const keyTips = computed(() => {
  const sel = find(selectedId.value)
  const ids = sel?.kind === 'entity'
    ? ['rename', 'addAttribute', 'connect', 'addGeneralization', 'duplicate', 'delete']
    : sel?.kind === 'relationship'
      ? ['rename', 'addAttribute', 'connect', 'duplicate', 'delete']
      : sel ? ['delete'] : ['newEntity', 'newRelationship', 'arrange', 'fit']
  const names: Record<string, string> = Object.fromEntries(SHORTCUTS.map(x => [x.id, x.label]))
  return ids.filter(id => keyLabel(id)).map(id => ({ id, key: keyLabel(id), name: names[id]! }))
})

const hint = computed(() => {
  if (mode.value !== 'link') return ''
  const first = find(pendingId.value)
  if (!first) return ''
  const name = first.kind === 'generalization' ? 'the generalization' : `“${first.name}”`
  const target = first.kind === 'entity' ? 'a relationship or generalization' : first.kind === 'relationship' ? 'an entity' : 'an entity (parent first, then children)'
  return `Connecting ${name}: now click ${target} — Esc to cancel`
})
</script>

<template>
  <TooltipProvider :delay-duration="300">
  <div class="flex h-screen flex-col">
    <header class="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
      <div class="mr-2 flex items-center gap-2 font-semibold">
        <Icon name="lucide:git-fork" class="size-5" /> ER Maker
      </div>

      <div class="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
        <span class="px-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Add</span>
        <Tip text="Add an entity (or double-click the canvas)" shortcut="newEntity"><Button variant="outline" size="sm" @click="addAt(addEntity)"><Icon name="lucide:square" /> Entity</Button></Tip>
        <Tip text="Add a relationship" shortcut="newRelationship"><Button variant="outline" size="sm" @click="addAt(addRelationship)"><Icon name="lucide:diamond" /> Relationship</Button></Tip>
        <Tip text="Add a generalization" shortcut="newGeneralization"><Button variant="outline" size="sm" @click="addAt(addGeneralization)"><Icon name="lucide:triangle" /> Generalization</Button></Tip>
      </div>

      <div class="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
        <span class="px-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Layout</span>
        <Tip text="Arrange all nodes once" shortcut="arrange"><Button variant="outline" size="sm" @click="runLayout({ fit: true })"><Icon name="lucide:wand-sparkles" /> Arrange</Button></Tip>
        <Tip text="Keep the layout automatic (disables dragging)" shortcut="toggleAuto">
          <label class="flex cursor-pointer items-center gap-1.5 px-1.5 text-sm">
            <Switch :model-value="autoLayout" @update:model-value="setAutoLayout($event === true)" /> Auto
          </label>
        </Tip>
      </div>

      <div class="flex items-center">
        <Tip text="Undo" shortcut="undo"><Button variant="ghost" size="icon-sm" :disabled="!canUndo" @click="undo"><Icon name="lucide:undo-2" /></Button></Tip>
        <Tip text="Redo" shortcut="redo"><Button variant="ghost" size="icon-sm" :disabled="!canRedo" @click="redo"><Icon name="lucide:redo-2" /></Button></Tip>
        <Separator orientation="vertical" class="mx-1 h-5" />
        <Tip text="Zoom out (or scroll)"><Button variant="ghost" size="icon-sm" @click="canvas?.zoom(1 / 1.25)"><Icon name="lucide:zoom-out" /></Button></Tip>
        <Tip text="Zoom in (or scroll)"><Button variant="ghost" size="icon-sm" @click="canvas?.zoom(1.25)"><Icon name="lucide:zoom-in" /></Button></Tip>
        <Tip text="Fit diagram" shortcut="fit"><Button variant="ghost" size="icon-sm" @click="canvas?.fit()"><Icon name="lucide:maximize" /></Button></Tip>
      </div>

      <div class="ml-auto flex items-center gap-1.5">
        <Tip text="Keyboard shortcuts"><Button variant="ghost" size="icon-sm" @click="shortcutsOpen = true"><Icon name="lucide:keyboard" /></Button></Tip>
        <Button variant="ghost" size="sm" @click="loadSample"><Icon name="lucide:sparkles" /> Example</Button>
        <Button variant="ghost" size="sm" @click="fileInput?.click()"><Icon name="lucide:upload" /> Import</Button>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="onImport">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm"><Icon name="lucide:download" /> Export</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="exportPng">PNG image</DropdownMenuItem>
            <DropdownMenuItem @click="exportSvg">SVG vector</DropdownMenuItem>
            <DropdownMenuItem @click="exportJson">JSON (editable)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon-sm" title="Clear diagram" @click="clearAll"><Icon name="lucide:eraser" /></Button>
        <Button variant="outline" size="icon-sm" aria-label="Toggle theme" @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'">
          <ClientOnly><Icon :name="colorMode.value === 'dark' ? 'lucide:sun' : 'lucide:moon'" /></ClientOnly>
        </Button>
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <main class="relative min-w-0 flex-1">
        <ClientOnly>
          <DiagramCanvas ref="canvas" />
        </ClientOnly>
        <div v-if="keyTips.length" class="pointer-events-none absolute bottom-3 left-3 flex max-w-[90%] flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm ring-1 ring-border">
          <span v-if="selectedId" class="flex items-center gap-1"><span class="inline-flex size-3.5 items-center justify-center rounded-full bg-blue-500 text-[10px] leading-none text-white">+</span> Drag to connect</span>
          <span v-for="t in keyTips" :key="t.id" class="flex items-center gap-1">
            <kbd class="rounded border bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground">{{ t.key }}</kbd> {{ t.name }}
          </span>
        </div>
        <div v-if="hint" class="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-1.5 text-sm text-white shadow-lg">{{ hint }}</div>
      </main>
      <aside class="w-80 shrink-0 overflow-y-auto border-l">
        <Inspector />
      </aside>
    </div>
  <ShortcutsDialog v-model:open="shortcutsOpen" />
  </div>
  </TooltipProvider>
</template>
