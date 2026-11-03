<script setup lang="ts">
import type { Notation } from '~/utils/notation'
/** First-visit tour: asks once, then spotlights parts of the UI. Re-runnable via `start()`. */
const STORAGE_KEY = 'er-maker:tour-done'
const { t } = useT()
const askOpen = ref(false)
const chooseOpen = ref(false)
const running = ref(false)
const { notation, set: setNotation } = useNotation()
const { fitRequest } = useDiagram()
const NOTATION_KEY = 'er-maker:notation'
/** First-visit notation picker; once closed, the tour offer follows. */
function choose(n?: Notation) {
  setNotation(n ?? notation.value)
  chooseOpen.value = false
  fitRequest.value++
  setTimeout(() => (askOpen.value = true), 250)
}
// the "notation" step flips between both renderings
const demoNotation = ref<Notation>('italian')
let flip: ReturnType<typeof setInterval> | undefined
watch(running, (r) => {
  clearInterval(flip)
  if (r) flip = setInterval(() => (demoNotation.value = demoNotation.value === 'italian' ? 'crow' : 'italian'), 2600)
})
onUnmounted(() => clearInterval(flip))
const index = ref(0)
const rect = ref<{ x: number, y: number, w: number, h: number } | null>(null)
const card = ref<HTMLElement>()
const cardStyle = ref<Record<string, string>>({})

interface Step { id: string, target?: string, m?: boolean, demo?: 'create' | 'node' | 'connect' | 'inspect' | 'inspectRel' }
const steps: Step[] = [
  { id: 'welcome', m: true },
  { id: 'tools', m: true, target: 'tools' },
  { id: 'create', m: true, demo: 'create' },
  { id: 'node', m: true, demo: 'node' },
  { id: 'connect', m: true, demo: 'connect' },
  { id: 'inspect', m: true, demo: 'inspect' },
  { id: 'inspectRel', m: true, demo: 'inspectRel' },
  { id: 'layout', target: 'layout' },
  { id: 'search', target: 'topright' },
  { id: 'warnings', target: 'topright' },
  { id: 'zoom', m: true, target: 'zoom' },
  { id: 'notation', target: 'menu' },
  { id: 'menu', target: 'menu' },
]
const mobile = ref(false)
const step = computed(() => steps[index.value]!)
/** i18n key prefix: steps with a dedicated touch version use `tour.m.*` on small screens */
const key = computed(() => `tour.${mobile.value && step.value.m ? 'm.' : ''}${step.value.id}`)
const last = computed(() => index.value === steps.length - 1)

function markDone() { try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ } }

function visibleEl(name?: string): HTMLElement | null {
  if (!name) return null
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`))
  return els.find(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed') ?? null
}

function place() {
  if (!running.value) return
  const el = visibleEl(step.value.target)
  const pad = 6
  if (el) {
    const r = el.getBoundingClientRect()
    rect.value = { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 }
  }
  else rect.value = null
  nextTick(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cw = card.value?.offsetWidth ?? 320
    const ch = card.value?.offsetHeight ?? 180
    const m = 12
    if (!rect.value) {
      cardStyle.value = { left: `${(vw - cw) / 2}px`, top: `${(vh - ch) / 2}px` }
      return
    }
    const r = rect.value
    let top = r.y + r.h + m
    if (top + ch > vh - m) top = r.y - ch - m
    if (top < m) top = Math.min(vh - ch - m, Math.max(m, r.y + r.h / 2 - ch / 2))
    const left = Math.min(Math.max(m, r.x + r.w / 2 - cw / 2), vw - cw - m)
    cardStyle.value = { left: `${left}px`, top: `${top}px` }
  })
}

watch([index, running], () => nextTick(place), { flush: 'post' })
watch(card, () => nextTick(place))
function start() {
  mobile.value = window.matchMedia('(max-width: 767px)').matches
  askOpen.value = false
  index.value = 0
  running.value = true
}
function stop() {
  running.value = false
  markDone()
}
function next() { if (last.value) stop(); else index.value++ }
function prev() { if (index.value > 0) index.value-- }
function skipAsk() { askOpen.value = false; markDone() }

function onKey(ev: KeyboardEvent) {
  if (!running.value) return
  if (ev.key === 'Escape') { ev.preventDefault(); stop() }
  else if (ev.key === 'ArrowRight' || ev.key === 'Enter') { ev.preventDefault(); next() }
  else if (ev.key === 'ArrowLeft') { ev.preventDefault(); prev() }
}
onMounted(() => {
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('resize', place)
  let done = false
  let chosen = false
  try {
    done = localStorage.getItem(STORAGE_KEY) === '1'
    chosen = localStorage.getItem(NOTATION_KEY) !== null
  }
  catch { /* ignore */ }
  if (!done) setTimeout(() => { if (chosen) askOpen.value = true; else chooseOpen.value = true }, 600)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('resize', place)
})
defineExpose({ start })
</script>

<template>
  <Dialog v-model:open="chooseOpen" @update:open="(o: boolean) => { if (!o) choose() }">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2"><Icon name="lucide:shapes" /> {{ t('notation.askTitle') }}</DialogTitle>
        <DialogDescription>{{ t('notation.askText') }}</DialogDescription>
      </DialogHeader>
      <div class="grid gap-3 sm:grid-cols-2">
        <button
          v-for="n in NOTATIONS"
          :key="n.id"
          type="button"
          class="space-y-2 rounded-lg border p-2 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          @click="choose(n.id)"
        >
          <NotationPreview :kind="n.id" />
          <span class="block px-1 pb-1">
            <span class="block text-sm font-semibold">{{ t(`notation.${n.id}`) }}</span>
            <span class="block text-xs text-muted-foreground">{{ t(`notation.${n.id}.hint`) }}</span>
          </span>
        </button>
      </div>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="askOpen" @update:open="(o: boolean) => { if (!o && !running) markDone() }">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2"><Icon name="lucide:graduation-cap" /> {{ t('tour.askTitle') }}</DialogTitle>
        <DialogDescription>{{ t('tour.askText') }}</DialogDescription>
      </DialogHeader>
      <DialogFooter class="gap-2">
        <Button variant="ghost" @click="skipAsk">{{ t('tour.skip') }}</Button>
        <Button @click="start">{{ t('tour.take') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Teleport to="body">
    <div v-if="running" class="fixed inset-0 z-[100]" role="dialog" aria-modal="true" :aria-label="t('tour.label')">
      <div v-if="!rect" class="absolute inset-0 bg-black/60" />
      <div
        v-else
        class="pointer-events-none absolute rounded-xl ring-2 ring-sky-400 transition-all duration-300"
        :style="{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px`, boxShadow: '0 0 0 9999px rgba(0,0,0,.6)' }"
      />
      <div
        ref="card"
        class="absolute w-[min(22rem,calc(100vw-1.5rem))] space-y-3 rounded-xl border bg-background p-4 text-foreground shadow-xl transition-all duration-300"
        :style="cardStyle"
      >
        <div class="flex items-start justify-between gap-2">
          <p class="font-semibold">{{ t(`${key}.title`) }}</p>
          <span class="shrink-0 text-xs text-muted-foreground">{{ index + 1 }} / {{ steps.length }}</span>
        </div>
        <div v-if="step.id === 'notation'" class="space-y-1">
          <NotationPreview :kind="demoNotation" />
          <p class="text-center text-xs font-medium text-muted-foreground">{{ t(`notation.${demoNotation}`) }}</p>
        </div>
        <TourDemo v-if="step.demo" :key="`${step.id}${mobile}`" :scenario="step.demo" :mobile="mobile" />
        <p class="text-sm text-muted-foreground">{{ t(`${key}.text`) }}</p>
        <div class="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" @click="stop">{{ t('tour.close') }}</Button>
          <div class="flex gap-2">
            <Button v-if="index > 0" variant="outline" size="sm" @click="prev">{{ t('tour.back') }}</Button>
            <Button size="sm" @click="next">{{ last ? t('tour.done') : t('tour.next') }}</Button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
