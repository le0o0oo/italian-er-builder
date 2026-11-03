<script setup lang="ts">
import type { Diagram } from '~/types/er'
import type { LayoutStrategy } from '~/utils/layout'
import type { Locale } from '~/utils/i18n'

const { t, locale } = useT()
const { canonical } = useSeo({ title: () => t('seo.title'), description: () => t('seo.desc') })
useHead({
  noscript: [{ innerHTML: () => `<p>${t('sr.noscript')}</p>`, tagPosition: 'bodyOpen' }],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': 'ER Builder',
      'url': canonical,
      'applicationCategory': 'DeveloperApplication',
      'operatingSystem': 'Any (web browser)',
      'description': 'Free online editor for entity-relationship diagrams in the Italian notation, with auto layout, design warnings and export to PNG, SVG, JSON and Mermaid.',
      'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR' },
      'featureList': ['Italian ER notation', '(min,max) cardinalities', 'Composite identifiers', 'Generalizations (t/p, e/s)', 'Auto layout strategies', 'Design rule warnings', 'Export to PNG, SVG, JSON and Mermaid'],
    }),
  }],
})

const colorMode = useColorMode()
const { diagram, selectedId, mode, pendingId, isEmpty, find, setMode, addEntity, addRelationship, addGeneralization, remove, load, init, undo, redo, canUndo, canRedo, duplicate, selected, addAttribute, addGeneralizationFor, autoLayout, setAutoLayout, layoutStrategy, setLayoutStrategy, runLayout, fitRequest } = useDiagram()
const SNAP_HALF = 0.3
const snap = ref<number | string | null>(SNAP_HALF)
function onSnap(v: number | string | null) {
  snap.value = v ?? SNAP_HALF
  setTimeout(() => canvas.value?.revealSelected(), 50)
}
watch(selectedId, () => { snap.value = SNAP_HALF }) // each new selection opens half-way
const isMobile = ref(false)
onMounted(() => {
  const mq = window.matchMedia('(max-width: 767px)')
  isMobile.value = mq.matches
  mq.addEventListener('change', e => (isMobile.value = e.matches))
})
const canvas = ref<{ revealSelected: () => void, focusNode: (id: string) => void, center: () => { x: number, y: number }, fit: () => void, zoom: (f: number) => void, exportSvg: (o?: { skipUnconnected?: boolean }) => { width: number, height: number, markup: string } }>()
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

const skipUnconnected = ref(false)
onMounted(() => { try { skipUnconnected.value = localStorage.getItem('er-maker:skip-unconnected') === '1' } catch { /* ignore */ } })
watch(skipUnconnected, (v) => { try { localStorage.setItem('er-maker:skip-unconnected', v ? '1' : '0') } catch { /* ignore */ } })
const exported = () => (skipUnconnected.value ? withoutUnconnected(diagram.value) : diagram.value)
const svgOpts = () => ({ skipUnconnected: skipUnconnected.value })

const exportJson = () => download('diagram.json', new Blob([JSON.stringify(exported(), null, 2)], { type: 'application/json' }))
const exportSvg = () => download('diagram.svg', new Blob([canvas.value!.exportSvg(svgOpts()).markup], { type: 'image/svg+xml' }))
function exportPng() {
  const { width, height, markup } = canvas.value!.exportSvg(svgOpts())
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
  catch { alert(t('alert.invalidFile')) }
}

const notice = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  notice.value = msg
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 2200)
}
const exportMermaid = () => download('diagram.mmd', new Blob([toMermaid(exported())], { type: 'text/plain' }))
async function copyMermaid() {
  try { await navigator.clipboard.writeText(toMermaid(exported())); flash(t('notice.copied')) }
  catch { flash(t('notice.clipboardFail')) }
}

const panel = 'flex items-center gap-1 rounded-xl border bg-background/80 p-1.5 shadow-lg backdrop-blur-md'

function loadSample() {
  load(sampleDiagram(t))
  nextTick(() => canvas.value?.fit())
}
function clearAll() {
  if (isEmpty.value || confirm(t('confirm.clear'))) {
    load(emptyDiagram())
    nextTick(() => canvas.value?.fit())
  }
}

const shortcuts = useShortcuts()
const shortcutsOpen = ref(false)
const searchOpen = ref(false)
function pickSearch(id: string) {
  focusFromWarning(id)
}

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
    case 'search': searchOpen.value = true; break
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
  return ids.filter(id => keyLabel(id)).map(id => ({ id, key: keyLabel(id), name: t(`shortcut.${id}`) }))
})

const hint = computed(() => {
  if (mode.value !== 'link') return ''
  const first = find(pendingId.value)
  if (!first) return ''
  const name = first.kind === 'generalization' ? t('hint.theGeneralization') : `“${first.name}”`
  const target = t(`hint.target.${first.kind}`)
  return t('hint.connecting', { name, target })
})
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div class="relative h-dvh overflow-hidden bg-background">
      <!-- Crawlable, screen-reader friendly description of the app (the canvas itself is client-rendered). -->
      <section class="sr-only" :aria-label="t('sr.about')">
        <h1>{{ t('sr.h1') }}</h1>
        <p>{{ t('sr.p') }}</p>
        <ul>
          <li>{{ t('sr.li1') }}</li>
          <li>{{ t('sr.li2') }}</li>
          <li>{{ t('sr.li3') }}</li>
          <li>{{ t('sr.li4') }}</li>
        </ul>
        <NuxtLink to="/guide">{{ t('sr.guide') }}</NuxtLink>
      </section>
      <div class="absolute inset-0">
        <ClientOnly><DiagramCanvas ref="canvas" /></ClientOnly>
      </div>

      <!-- top left: brand + file menu -->
      <div :class="[panel, 'absolute top-4 left-4']">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="gap-2 font-semibold">
              <Icon name="lucide:git-fork" class="size-4" /> <span class="hidden sm:inline">ER Builder</span> <Icon name="lucide:chevron-down" class="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-52">
            <DropdownMenuItem as-child><NuxtLink to="/guide"><Icon name="lucide:book-open" /> {{ t('menu.guide') }}</NuxtLink></DropdownMenuItem>
            <DropdownMenuItem as-child><a href="https://github.com/le0o0oo/italian-er-builder" target="_blank" rel="noopener noreferrer"><Icon name="lucide:github" /> GitHub</a></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="loadSample"><Icon name="lucide:sparkles" /> {{ t('menu.example') }}</DropdownMenuItem>
            <DropdownMenuItem @select="fileInput?.click()"><Icon name="lucide:upload" /> {{ t('menu.import') }}</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><Icon name="lucide:download" /> {{ t('menu.export') }}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuLabel class="text-xs text-muted-foreground">{{ t('menu.exportOptions') }}</DropdownMenuLabel>
                <DropdownMenuCheckboxItem :model-value="skipUnconnected" @select.prevent @update:model-value="skipUnconnected = $event === true">{{ t('menu.skipUnconnected') }}</DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel class="text-xs text-muted-foreground">{{ t('menu.exportAs') }}</DropdownMenuLabel>
                <DropdownMenuItem @select="exportPng"><Icon name="lucide:image" /> {{ t('menu.png') }}</DropdownMenuItem>
                <DropdownMenuItem @select="exportSvg"><Icon name="lucide:file-code" /> {{ t('menu.svg') }}</DropdownMenuItem>
                <DropdownMenuItem @select="exportJson"><Icon name="lucide:braces" /> {{ t('menu.json') }}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem @select="exportMermaid"><Icon name="lucide:workflow" /> {{ t('menu.mermaid') }}</DropdownMenuItem>
                <DropdownMenuItem @select="copyMermaid"><Icon name="lucide:clipboard-copy" /> {{ t('menu.copyMermaid') }}</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" @select="clearAll"><Icon name="lucide:eraser" /> {{ t('menu.clear') }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="onImport">
      </div>

      <!-- top center: tools -->
      <div :class="[panel, 'absolute bottom-4 left-1/2 z-10 -translate-x-1/2 md:top-4 md:bottom-auto', selected && 'max-md:hidden']">
        <Tip :text="t('tip.addEntity')" shortcut="newEntity">
          <Button variant="ghost" @click="addAt(addEntity)"><Icon name="lucide:square" /><span class="hidden lg:inline">{{ t('tool.entity') }}</span></Button>
        </Tip>
        <Tip :text="t('tip.addRelationship')" shortcut="newRelationship">
          <Button variant="ghost" @click="addAt(addRelationship)"><Icon name="lucide:diamond" /><span class="hidden lg:inline">{{ t('tool.relationship') }}</span></Button>
        </Tip>
        <Tip :text="t('tip.addGeneralization')" shortcut="newGeneralization">
          <Button variant="ghost" @click="addAt(addGeneralization)"><Icon name="lucide:triangle" /><span class="hidden lg:inline">{{ t('tool.generalization') }}</span></Button>
        </Tip>
        <Separator orientation="vertical" class="mx-0.5 h-5 data-[orientation=vertical]:self-center" />
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button :variant="autoLayout ? 'secondary' : 'ghost'" :title="t('layout.options')">
              <Icon name="lucide:wand-sparkles" /><span class="hidden lg:inline">{{ t('layout.title') }}</span>
              <span v-if="autoLayout" class="size-1.5 rounded-full bg-emerald-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" class="w-60">
            <DropdownMenuItem @select="runLayout({ fit: true })">
              <Icon name="lucide:wand-sparkles" /> {{ t('layout.arrangeNow') }} <DropdownMenuShortcut>{{ shortcuts.label('arrange') }}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel class="text-xs text-muted-foreground">{{ t('layout.strategy') }}</DropdownMenuLabel>
            <DropdownMenuRadioGroup :model-value="layoutStrategy" @update:model-value="setLayoutStrategy($event as LayoutStrategy)">
              <DropdownMenuRadioItem v-for="st in LAYOUT_STRATEGIES" :key="st.id" :value="st.id">
                <span class="flex flex-col"><span>{{ t(`layout.${st.id}`) }}</span><span class="text-xs text-muted-foreground">{{ t(`layout.${st.id}.hint`) }}</span></span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem :model-value="autoLayout" @update:model-value="setAutoLayout($event === true)">
              {{ t('layout.auto') }} <DropdownMenuShortcut>{{ shortcuts.label('toggleAuto') }}</DropdownMenuShortcut>
            </DropdownMenuCheckboxItem>
            <p class="px-2 pb-1.5 text-xs text-muted-foreground">{{ t('layout.autoNote') }}</p>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" class="mx-0.5 h-5 data-[orientation=vertical]:self-center" />
        <Tip :text="t('tip.undo')" shortcut="undo"><Button variant="ghost" size="icon" :disabled="!canUndo" @click="undo"><Icon name="lucide:undo-2" /></Button></Tip>
        <Tip :text="t('tip.redo')" shortcut="redo"><Button variant="ghost" size="icon" :disabled="!canRedo" @click="redo"><Icon name="lucide:redo-2" /></Button></Tip>
      </div>

      <!-- top right -->
      <div :class="[panel, 'absolute top-4 right-4']">
        <Tip :text="t('tip.search')" shortcut="search"><Button variant="ghost" size="icon" @click="searchOpen = true"><Icon name="lucide:search" /></Button></Tip>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="gap-1.5 px-2 uppercase" :title="t('tip.language')">
              <Icon name="lucide:languages" /> {{ locale }}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup :model-value="locale" @update:model-value="locale = $event as Locale">
              <DropdownMenuRadioItem v-for="l in LOCALES" :key="l.code" :value="l.code">{{ l.label }}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <WarningsPanel @focus="focusFromWarning" />
        <Tip :text="t('tip.shortcuts')"><Button class="max-md:hidden" variant="ghost" size="icon" @click="shortcutsOpen = true"><Icon name="lucide:keyboard" /></Button></Tip>
        <Tip :text="t('tip.theme')">
          <Button variant="ghost" size="icon" aria-label="Toggle theme" @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'">
            <ClientOnly><Icon :name="colorMode.value === 'dark' ? 'lucide:sun' : 'lucide:moon'" /></ClientOnly>
          </Button>
        </Tip>
      </div>

      <!-- inspector: only while something is selected -->
      <aside v-if="selected && !isMobile" data-inspector class="absolute top-[4.75rem] right-4 z-10 max-h-[calc(100%-6.5rem)] w-80 overflow-y-auto rounded-xl border bg-background/85 shadow-lg backdrop-blur-md">
        <Inspector />
      </aside>
      <Drawer :open="!!selected && isMobile" :modal="false" :snap-points="[SNAP_HALF, 1]" :snap-point="snap" @update:snap-point="onSnap" @update:open="(o: boolean) => { if (!o) selectedId = null }">
        <DrawerContent hide-overlay data-inspector :data-snap="snap" class="h-[60dvh]">
          <DrawerTitle class="sr-only">{{ selected ? t(`insp.${selected.kind}`) : '' }}</DrawerTitle>
          <DrawerDescription class="sr-only">{{ selected?.name }}</DrawerDescription>
          <div :class="['min-h-0 flex-1', snap === SNAP_HALF ? 'overflow-hidden' : 'overflow-y-auto']"><Inspector /></div>
        </DrawerContent>
      </Drawer>

      <!-- bottom left: zoom -->
      <div :class="[panel, 'absolute bottom-20 left-4 md:bottom-4', selected && 'max-md:hidden']">
        <Tip :text="t('tip.zoomOut')" side="top"><Button variant="ghost" size="icon" @click="canvas?.zoom(1 / 1.25)"><Icon name="lucide:zoom-out" /></Button></Tip>
        <Tip :text="t('tip.zoomIn')" side="top"><Button variant="ghost" size="icon" @click="canvas?.zoom(1.25)"><Icon name="lucide:zoom-in" /></Button></Tip>
        <Tip :text="t('tip.fit')" shortcut="fit" side="top"><Button variant="ghost" size="icon" @click="canvas?.fit()"><Icon name="lucide:maximize" /></Button></Tip>
      </div>

      <!-- bottom center: contextual shortcut tips -->
      <div v-if="keyTips.length" :class="[panel, 'pointer-events-none absolute max-md:hidden bottom-4 left-1/2 -translate-x-1/2 gap-x-3 px-3 text-xs text-muted-foreground']">
        <span v-if="selectedId" class="flex items-center gap-1"><span class="inline-flex size-4 items-center justify-center rounded-full bg-blue-500 text-[10px] leading-none text-white">+</span> {{ t('tips.dragConnect') }}</span>
        <span v-for="t in keyTips" :key="t.id" class="flex items-center gap-1">
          <kbd class="rounded border bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground">{{ t.key }}</kbd> {{ t.name }}
        </span>
      </div>

      <!-- transient messages -->
      <div v-if="hint || notice" :class="[panel, 'pointer-events-none absolute top-[4.75rem] left-1/2 -translate-x-1/2 bg-neutral-900/90 px-4 text-sm text-white']">{{ hint || notice }}</div>

      <ShortcutsDialog v-model:open="shortcutsOpen" />
      <SearchDialog v-model:open="searchOpen" @pick="pickSearch" />
    </div>
  </TooltipProvider>
</template>
