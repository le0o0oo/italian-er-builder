<script setup lang="ts">
import type { Diagram } from '~/types/er'
import type { LayoutStrategy } from '~/utils/layout'

const colorMode = useColorMode()
const { diagram, selectedId, mode, pendingId, isEmpty, find, setMode, addEntity, addRelationship, addGeneralization, remove, load, init, undo, redo, canUndo, canRedo, duplicate, selected, addAttribute, addGeneralizationFor, autoLayout, setAutoLayout, layoutStrategy, setLayoutStrategy, runLayout, fitRequest } = useDiagram()
const canvas = ref<{ focusNode: (id: string) => void, center: () => { x: number, y: number }, fit: () => void, zoom: (f: number) => void, exportSvg: () => { width: number, height: number, markup: string } }>()
const fileInput = ref<HTMLInputElement>()

const { load: loadRules } = useWarnings()
onMounted(() => { init(); shortcuts.load(); loadRules() })
function focusFromWarning(id: string) {
  setMode('select')
  selectedId.value = id
  canvas.value?.focusNode(id)
}
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

const notice = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  notice.value = msg
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 2200)
}
const exportMermaid = () => download('diagram.mmd', new Blob([toMermaid(diagram.value)], { type: 'text/plain' }))
async function copyMermaid() {
  try { await navigator.clipboard.writeText(toMermaid(diagram.value)); flash('Mermaid copied to clipboard') }
  catch { flash('Could not access the clipboard') }
}

const panel = 'flex items-center gap-1 rounded-xl border bg-background/80 p-1.5 shadow-lg backdrop-blur-md'

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
    <div class="relative h-screen overflow-hidden bg-background">
      <div class="absolute inset-0">
        <ClientOnly><DiagramCanvas ref="canvas" /></ClientOnly>
      </div>

      <!-- top left: brand + file menu -->
      <div :class="[panel, 'absolute top-4 left-4']">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="gap-2 font-semibold">
              <Icon name="lucide:git-fork" class="size-4" /> ER Maker <Icon name="lucide:chevron-down" class="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-52">
            <DropdownMenuItem @select="loadSample"><Icon name="lucide:sparkles" /> Load example</DropdownMenuItem>
            <DropdownMenuItem @select="fileInput?.click()"><Icon name="lucide:upload" /> Import JSON…</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><Icon name="lucide:download" /> Export</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem @select="exportPng"><Icon name="lucide:image" /> PNG image</DropdownMenuItem>
                <DropdownMenuItem @select="exportSvg"><Icon name="lucide:file-code" /> SVG vector</DropdownMenuItem>
                <DropdownMenuItem @select="exportJson"><Icon name="lucide:braces" /> JSON (editable)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem @select="exportMermaid"><Icon name="lucide:workflow" /> Mermaid file (.mmd)</DropdownMenuItem>
                <DropdownMenuItem @select="copyMermaid"><Icon name="lucide:clipboard-copy" /> Copy as Mermaid</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" @select="clearAll"><Icon name="lucide:eraser" /> Clear diagram</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="onImport">
      </div>

      <!-- top center: tools -->
      <div :class="[panel, 'absolute top-4 left-1/2 -translate-x-1/2']">
        <Tip text="Add an entity (or double-click the canvas)" shortcut="newEntity">
          <Button variant="ghost" @click="addAt(addEntity)"><Icon name="lucide:square" /><span class="hidden lg:inline">Entity</span></Button>
        </Tip>
        <Tip text="Add a relationship" shortcut="newRelationship">
          <Button variant="ghost" @click="addAt(addRelationship)"><Icon name="lucide:diamond" /><span class="hidden lg:inline">Relationship</span></Button>
        </Tip>
        <Tip text="Add a generalization" shortcut="newGeneralization">
          <Button variant="ghost" @click="addAt(addGeneralization)"><Icon name="lucide:triangle" /><span class="hidden lg:inline">Generalization</span></Button>
        </Tip>
        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button :variant="autoLayout ? 'secondary' : 'ghost'" title="Layout options">
              <Icon name="lucide:wand-sparkles" /><span class="hidden lg:inline">Layout</span>
              <span v-if="autoLayout" class="size-1.5 rounded-full bg-emerald-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" class="w-60">
            <DropdownMenuItem @select="runLayout({ fit: true })">
              <Icon name="lucide:wand-sparkles" /> Arrange now <DropdownMenuShortcut>{{ shortcuts.label('arrange') }}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel class="text-xs text-muted-foreground">Strategy</DropdownMenuLabel>
            <DropdownMenuRadioGroup :model-value="layoutStrategy" @update:model-value="setLayoutStrategy($event as LayoutStrategy)">
              <DropdownMenuRadioItem v-for="st in LAYOUT_STRATEGIES" :key="st.id" :value="st.id">
                <span class="flex flex-col"><span>{{ st.label }}</span><span class="text-xs text-muted-foreground">{{ st.hint }}</span></span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem :model-value="autoLayout" @update:model-value="setAutoLayout($event === true)">
              Auto-arrange <DropdownMenuShortcut>{{ shortcuts.label('toggleAuto') }}</DropdownMenuShortcut>
            </DropdownMenuCheckboxItem>
            <p class="px-2 pb-1.5 text-xs text-muted-foreground">While on, nodes can't be dragged.</p>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <Tip text="Undo" shortcut="undo"><Button variant="ghost" size="icon" :disabled="!canUndo" @click="undo"><Icon name="lucide:undo-2" /></Button></Tip>
        <Tip text="Redo" shortcut="redo"><Button variant="ghost" size="icon" :disabled="!canRedo" @click="redo"><Icon name="lucide:redo-2" /></Button></Tip>
      </div>

      <!-- top right -->
      <div :class="[panel, 'absolute top-4 right-4']">
        <WarningsPanel @focus="focusFromWarning" />
        <Tip text="Keyboard shortcuts"><Button variant="ghost" size="icon" @click="shortcutsOpen = true"><Icon name="lucide:keyboard" /></Button></Tip>
        <Tip text="Toggle theme">
          <Button variant="ghost" size="icon" aria-label="Toggle theme" @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'">
            <ClientOnly><Icon :name="colorMode.value === 'dark' ? 'lucide:sun' : 'lucide:moon'" /></ClientOnly>
          </Button>
        </Tip>
      </div>

      <!-- inspector: only while something is selected -->
      <aside v-if="selected" class="absolute top-[4.75rem] right-4 max-h-[calc(100%-6.5rem)] w-80 overflow-y-auto rounded-xl border bg-background/85 shadow-lg backdrop-blur-md">
        <Inspector />
      </aside>

      <!-- bottom left: zoom -->
      <div :class="[panel, 'absolute bottom-4 left-4']">
        <Tip text="Zoom out (or scroll)" side="top"><Button variant="ghost" size="icon" @click="canvas?.zoom(1 / 1.25)"><Icon name="lucide:zoom-out" /></Button></Tip>
        <Tip text="Zoom in (or scroll)" side="top"><Button variant="ghost" size="icon" @click="canvas?.zoom(1.25)"><Icon name="lucide:zoom-in" /></Button></Tip>
        <Tip text="Fit diagram" shortcut="fit" side="top"><Button variant="ghost" size="icon" @click="canvas?.fit()"><Icon name="lucide:maximize" /></Button></Tip>
      </div>

      <!-- bottom center: contextual shortcut tips -->
      <div v-if="keyTips.length" :class="[panel, 'pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 gap-x-3 px-3 text-xs text-muted-foreground']">
        <span v-if="selectedId" class="flex items-center gap-1"><span class="inline-flex size-4 items-center justify-center rounded-full bg-blue-500 text-[10px] leading-none text-white">+</span> Drag to connect</span>
        <span v-for="t in keyTips" :key="t.id" class="flex items-center gap-1">
          <kbd class="rounded border bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground">{{ t.key }}</kbd> {{ t.name }}
        </span>
      </div>

      <!-- transient messages -->
      <div v-if="hint || notice" :class="[panel, 'pointer-events-none absolute top-[4.75rem] left-1/2 -translate-x-1/2 bg-neutral-900/90 px-4 text-sm text-white']">{{ hint || notice }}</div>

      <ShortcutsDialog v-model:open="shortcutsOpen" />
    </div>
  </TooltipProvider>
</template>
