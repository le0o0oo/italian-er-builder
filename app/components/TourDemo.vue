<script setup lang="ts">
/** Looping animated mini-canvas used by the tour: a fake pointer (mouse cursor or finger) performs the real gestures on sample shapes. */
const props = defineProps<{ scenario: 'create' | 'node' | 'connect' | 'inspect' | 'inspectRel', mobile?: boolean }>()
const { t } = useT()

const W = 320
const H = 170
const MENU_W = 124
const ITEM_H = 18
const CARDS = ['1,1', '0,1', '1,N', '0,N']
const m = props.mobile === true

/** Layout of the (simplified) edit panel: a side card on desktop, a bottom drawer on mobile. Coordinates inside are local. */
const L = m
  ? { px: 6, py: 62, pw: 308, ph: 120, header: 17, nameLbl: 30, nameIn: 33, attrLbl: 62, btnY: 52, row: 70, pk: 0, conn: 62, connRow: 70, ddY: 2 }
  : { px: 142, py: 6, pw: 172, ph: 158, header: 22, nameLbl: 37, nameIn: 40, attrLbl: 76, btnY: 66, row: 88, pk: 112, conn: 76, connRow: 88, ddY: 104 }

const cur = reactive({ x: 270, y: 155 })
const ping = ref(0)
const hold = ref(0)
const press = ref(false)
const ent = reactive({ show: false, x: 70, y: 70, selected: false, name: '' })
const rel = reactive({ show: false, x: 230, y: 85, target: false, name: '' })
const gen = reactive({ show: false, x: 150, y: 90 })
const attr = ref(false)
const attrKey = ref(false)
const link = ref(false)
const linkCard = ref('1,N')
const dragFrom = ref(false)
const tapBtn = ref(-1)
const menu = ref<{ x: number, y: number, items: string[], hl: number } | null>(null)
const panel = reactive({ show: false, kind: 'entity' as 'entity' | 'rel', focus: false, row: false, dd: false, ddHl: -1 })

let dead = false
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
function moveTo(x: number, y: number, ms = 750) {
  const sx = cur.x
  const sy = cur.y
  const t0 = performance.now()
  return new Promise<void>((res) => {
    const f = (now: number) => {
      if (dead) return res()
      const p = Math.min(1, (now - t0) / ms)
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
      cur.x = sx + (x - sx) * e
      cur.y = sy + (y - sy) * e
      if (p < 1) requestAnimationFrame(f)
      else res()
    }
    requestAnimationFrame(f)
  })
}
const click = () => { ping.value++ }
/** right-click on desktop, long-press on touch */
async function context() {
  if (m) { hold.value++; press.value = true; await sleep(600); press.value = false }
  else { await sleep(250); click() }
}

function openMenu(x: number, y: number, items: string[]) {
  const h = items.length * ITEM_H + 8
  menu.value = { x: Math.min(x, W - MENU_W - 4), y: Math.min(y, H - h - 4), items, hl: -1 }
}
async function pick(i: number) {
  const mn = menu.value!
  await moveTo(mn.x + 34, mn.y + 4 + i * ITEM_H + ITEM_H / 2, 600)
  mn.hl = i
  await sleep(450)
  click()
  await sleep(200)
}

function reset() {
  Object.assign(cur, { x: 270, y: 155 })
  Object.assign(ent, { show: false, x: 70, y: 70, selected: false, name: t('default.entity') })
  Object.assign(rel, { show: false, x: 230, y: 85, target: false, name: t('default.relationship') })
  Object.assign(gen, { show: false })
  Object.assign(panel, { show: false, kind: 'entity', focus: false, row: false, dd: false, ddHl: -1 })
  attr.value = false
  attrKey.value = false
  link.value = false
  linkCard.value = '1,N'
  dragFrom.value = false
  press.value = false
  tapBtn.value = -1
  menu.value = null
}

async function create() {
  reset()
  const items = [t('tool.entity'), t('tool.relationship'), t('tool.generalization')]
  await sleep(500)
  await moveTo(70, 50)
  await context()
  openMenu(70, 50, items)
  await sleep(500)
  await pick(0)
  Object.assign(ent, { show: true, x: 70, y: 50 })
  menu.value = null
  await sleep(900)
  await moveTo(225, m ? 55 : 85)
  await context()
  openMenu(225, m ? 55 : 85, items)
  await sleep(500)
  await pick(1)
  Object.assign(rel, { show: true, x: 225, y: m ? 55 : 85 })
  menu.value = null
  if (m) {
    // the bottom toolbar: tap the generalization button
    await sleep(900)
    await moveTo(190, 150)
    await sleep(300)
    tapBtn.value = 2
    click()
    await sleep(250)
    Object.assign(gen, { show: true, x: 148, y: 105 })
    tapBtn.value = -1
  }
  await sleep(1800)
}

async function node() {
  reset()
  Object.assign(ent, { show: true, x: 70, y: 70, selected: false })
  await sleep(500)
  await moveTo(ent.x, ent.y)
  await context()
  ent.selected = true
  openMenu(ent.x, ent.y, [t('ctx.rename'), t('ctx.addAttribute'), t('ctx.connectTo'), t('ctx.duplicate'), t('ctx.delete')])
  await sleep(600)
  await pick(1)
  attr.value = true
  menu.value = null
  await sleep(1000)
  await moveTo(ent.x, ent.y, 600)
  press.value = true
  const grab = { x: ent.x - cur.x, y: ent.y - cur.y }
  const stop = setInterval(() => { ent.x = cur.x + grab.x; ent.y = cur.y + grab.y }, 16)
  await moveTo(190, 105, 1000)
  clearInterval(stop)
  ent.x = cur.x + grab.x
  ent.y = cur.y + grab.y
  press.value = false
  await sleep(1800)
}

async function connect() {
  reset()
  Object.assign(ent, { show: true, x: 60, y: 85, selected: true })
  Object.assign(rel, { show: true, x: 235, y: 85, target: false })
  await sleep(700)
  await moveTo(ent.x + 50, ent.y)
  await sleep(300)
  press.value = true
  dragFrom.value = true
  await moveTo(rel.x - 20, rel.y, 1000)
  rel.target = true
  await sleep(500)
  press.value = false
  dragFrom.value = false
  rel.target = false
  link.value = true
  click()
  await sleep(2200)
}

async function typeName(target: { name: string }, text: string) {
  panel.focus = true
  target.name = ''
  for (const ch of text) {
    if (dead) return
    target.name += ch
    await sleep(110)
  }
  await sleep(400)
  panel.focus = false
}

/** absolute position of a point given in the panel's local coordinates */
const abs = (x: number, y: number) => ({ x: L.px + x, y: L.py + y })

async function inspect() {
  reset()
  Object.assign(ent, { show: true, x: m ? 160 : 62, y: m ? 38 : 95 })
  await sleep(600)
  await moveTo(ent.x, ent.y)
  await sleep(250)
  click()
  ent.selected = true
  panel.show = true
  await sleep(900)
  const name = abs(L.pw / 2, L.nameIn + 8)
  await moveTo(name.x, name.y)
  await sleep(250)
  click()
  await typeName(ent, t('sample.emp'))
  const add = abs(L.pw - 31, L.btnY + 7)
  await moveTo(add.x, add.y)
  await sleep(250)
  click()
  panel.row = true
  attr.value = true
  await sleep(900)
  const key = abs(L.pw - 25, L.row + 7)
  await moveTo(key.x, key.y)
  await sleep(300)
  click()
  attrKey.value = true
  await sleep(2400)
}

async function inspectRel() {
  reset()
  if (m) {
    Object.assign(ent, { show: true, x: 70, y: 36, name: t('sample.emp') })
    Object.assign(rel, { show: true, x: 250, y: 36 })
  }
  else {
    Object.assign(ent, { show: true, x: 62, y: 40, name: t('sample.emp') })
    Object.assign(rel, { show: true, x: 62, y: 125 })
  }
  link.value = true
  linkCard.value = '1,1'
  panel.kind = 'rel'
  await sleep(600)
  await moveTo(rel.x, rel.y)
  await sleep(250)
  click()
  panel.show = true
  await sleep(1000)
  const sel = abs(L.pw - 43, L.connRow + 7)
  await moveTo(sel.x, sel.y)
  await sleep(300)
  click()
  panel.dd = true
  await sleep(700)
  panel.ddHl = 3
  const opt = abs(L.pw - 43, L.ddY + 3 * 14 + 7)
  await moveTo(opt.x, opt.y, 700)
  await sleep(400)
  click()
  linkCard.value = CARDS[3]!
  panel.dd = false
  await sleep(2400)
}

onMounted(async () => {
  const run = { create, node, connect, inspect, inspectRel }[props.scenario]
  while (!dead) await run()
})
onUnmounted(() => { dead = true })
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="w-full rounded-lg border bg-muted/40 text-foreground select-none" aria-hidden="true" font-family="Arial, Helvetica, sans-serif">
    <line v-if="link" :x1="ent.x" :y1="ent.y" :x2="rel.x" :y2="rel.y" class="stroke-foreground" stroke-width="1.5" />
    <text v-if="link" :x="(ent.x + rel.x) / 2 + (panel.show && !m ? 4 : 0)" :y="(ent.y + rel.y) / 2 - (panel.show && !m ? 0 : 6)" :text-anchor="panel.show && !m ? 'start' : 'middle'" font-size="9" class="fill-muted-foreground">({{ linkCard }})</text>
    <line v-if="dragFrom" :x1="ent.x" :y1="ent.y" :x2="cur.x" :y2="cur.y" class="stroke-sky-500" stroke-width="2" stroke-dasharray="6 4" />

    <g v-if="gen.show" :transform="`translate(${gen.x} ${gen.y})`">
      <polygon points="0,-14 16,12 -16,12" class="fill-background stroke-foreground" stroke-width="1.5" />
      <text y="8" text-anchor="middle" font-size="8" class="fill-foreground">t,e</text>
    </g>

    <g v-if="rel.show" :transform="`translate(${rel.x} ${rel.y})`">
      <polygon points="0,-20 42,0 0,20 -42,0" class="fill-background stroke-foreground" stroke-width="1.5" />
      <text y="3" text-anchor="middle" font-size="9" class="fill-foreground">{{ rel.name }}</text>
      <polygon v-if="rel.target" points="0,-25 52,0 0,25 -52,0" fill="none" class="stroke-amber-500" stroke-width="2" stroke-dasharray="5 3" />
    </g>

    <g v-if="ent.show" :transform="`translate(${ent.x} ${ent.y})`">
      <template v-if="attr">
        <line x1="0" y1="-15" x2="0" y2="-30" class="stroke-foreground" stroke-width="1.5" />
        <circle cx="0" cy="-35" r="5" :class="attrKey ? 'fill-foreground' : 'fill-background'" class="stroke-foreground" stroke-width="1.5" />
        <text x="10" y="-32" font-size="9" class="fill-foreground">{{ t('default.attribute') }}</text>
      </template>
      <rect x="-32" y="-15" width="64" height="30" class="fill-background stroke-foreground" stroke-width="1.5" />
      <text y="3" text-anchor="middle" font-size="10" font-weight="600" class="fill-foreground">{{ ent.name }}</text>
      <rect v-if="ent.selected" x="-37" y="-20" width="74" height="40" fill="none" class="stroke-sky-500" stroke-width="2" stroke-dasharray="5 3" />
      <g v-if="ent.selected && !dragFrom && !press && !menu && !panel.show" transform="translate(50 0)">
        <circle r="8" class="fill-blue-500" />
        <path d="M-4 0H4M0 -4V4" stroke="white" stroke-width="1.8" stroke-linecap="round" />
      </g>
    </g>

    <!-- mobile: bottom toolbar -->
    <g v-if="m && scenario === 'create'">
      <rect x="104" y="138" width="112" height="26" rx="8" class="fill-background stroke-border" />
      <rect v-if="tapBtn >= 0" :x="108 + tapBtn * 34" y="141" width="32" height="20" rx="5" class="fill-accent" />
      <rect x="118" y="146" width="14" height="10" class="fill-none stroke-foreground" stroke-width="1.2" />
      <polygon points="159,144 167,151 159,158 151,151" class="fill-none stroke-foreground" stroke-width="1.2" />
      <polygon points="186,144 193,157 179,157" class="fill-none stroke-foreground" stroke-width="1.2" />
    </g>

    <!-- edit panel: side card on desktop, bottom drawer on mobile -->
    <g v-if="panel.show" :transform="`translate(${L.px} ${L.py})`">
      <rect x="0" y="0" :width="L.pw" :height="L.ph" rx="6" class="fill-background stroke-border" />
      <rect v-if="m" :x="L.pw / 2 - 14" y="4" width="28" height="3" rx="1.5" class="fill-muted-foreground/40" />
      <text x="10" :y="L.header" font-size="9" font-weight="600" class="fill-foreground">{{ panel.kind === 'entity' ? t('insp.entity') : t('insp.relationship') }}</text>
      <text :x="L.pw - 10" :y="L.header" font-size="9" text-anchor="end" class="fill-muted-foreground">✕</text>
      <text x="10" :y="L.nameLbl" font-size="7.5" class="fill-muted-foreground">{{ t('insp.name') }}</text>
      <rect x="10" :y="L.nameIn" :width="L.pw - 20" height="16" rx="3" fill="none" :class="panel.focus ? 'stroke-sky-500' : 'stroke-border'" :stroke-width="panel.focus ? 1.5 : 1" />
      <text x="15" :y="L.nameIn + 11" font-size="9" class="fill-foreground">{{ panel.kind === 'entity' ? ent.name : rel.name }}{{ panel.focus ? '|' : '' }}</text>

      <template v-if="panel.kind === 'entity'">
        <text x="10" :y="L.attrLbl" font-size="7.5" class="fill-muted-foreground">{{ t('attr.title') }}</text>
        <rect :x="L.pw - 52" :y="L.btnY" width="42" height="14" rx="3" fill="none" class="stroke-border" />
        <text :x="L.pw - 31" :y="L.btnY + 10" font-size="8" text-anchor="middle" class="fill-foreground">+ {{ t('attr.add') }}</text>
        <g v-if="panel.row">
          <rect x="10" :y="L.row" :width="L.pw - 78" height="14" rx="3" fill="none" class="stroke-border" />
          <text x="15" :y="L.row + 10" font-size="8" class="fill-foreground">{{ t('default.attribute') }}</text>
          <rect :x="L.pw - 64" :y="L.row" width="28" height="14" rx="3" fill="none" class="stroke-border" />
          <text :x="L.pw - 50" :y="L.row + 10" font-size="7.5" text-anchor="middle" class="fill-foreground">(1,1)</text>
          <rect :x="L.pw - 32" :y="L.row" width="14" height="14" rx="3" :class="attrKey ? 'fill-foreground' : 'fill-background'" class="stroke-border" />
          <g :transform="`translate(${L.pw - 25} ${L.row + 7})`" fill="none" stroke-width="1.2" stroke-linecap="round" :class="attrKey ? 'stroke-background' : 'stroke-foreground'">
            <circle cx="-1.5" cy="1.5" r="2" /><path d="M0 0L3.5 -3.5M2 -2L3.5 -0.5" />
          </g>
          <template v-if="!m">
            <rect x="10" :y="L.pk" :width="L.pw - 20" height="16" rx="3" class="fill-muted" />
            <text x="15" :y="L.pk + 11" font-size="8" class="fill-foreground"><tspan font-weight="600">{{ t('insp.pk') }}</tspan><tspan v-if="attrKey"> {{ t('default.attribute') }}</tspan><tspan v-else class="fill-muted-foreground"> —</tspan></text>
          </template>
        </g>
      </template>
      <template v-else>
        <text x="10" :y="L.conn" font-size="7.5" class="fill-muted-foreground">{{ t('insp.connections') }}</text>
        <rect x="10" :y="L.connRow" :width="L.pw - 74" height="14" rx="3" class="fill-muted" />
        <text x="15" :y="L.connRow + 10" font-size="8" class="fill-foreground">{{ ent.name }}</text>
        <rect :x="L.pw - 60" :y="L.connRow" width="34" height="14" rx="3" class="fill-background stroke-border" />
        <text :x="L.pw - 54" :y="L.connRow + 10" font-size="8" class="fill-foreground">({{ linkCard }})</text>
        <text :x="L.pw - 36" :y="L.connRow + 10" font-size="7" class="fill-muted-foreground">▾</text>
        <circle :cx="L.pw - 15" :cy="L.connRow + 7" r="6" class="fill-background stroke-border" />
        <circle :cx="L.pw - 15" :cy="L.connRow + 7" r="1.8" class="fill-foreground" />
        <g v-if="panel.dd">
          <rect :x="L.pw - 60" :y="L.ddY" width="40" height="60" rx="4" class="fill-background stroke-border" />
          <g v-for="(c, i) in CARDS" :key="c">
            <rect v-if="panel.ddHl === i" :x="L.pw - 58" :y="L.ddY + 2 + i * 14" width="36" height="13" rx="3" class="fill-accent" />
            <text :x="L.pw - 52" :y="L.ddY + 11.5 + i * 14" font-size="8" class="fill-foreground">({{ c }})</text>
          </g>
        </g>
      </template>
    </g>

    <g v-if="menu">
      <rect :x="menu.x" :y="menu.y" :width="MENU_W" :height="menu.items.length * ITEM_H + 8" rx="5" class="fill-background stroke-border" />
      <g v-for="(it, i) in menu.items" :key="i">
        <rect v-if="menu.hl === i" :x="menu.x + 3" :y="menu.y + 4 + i * ITEM_H" :width="MENU_W - 6" :height="ITEM_H" rx="3" class="fill-accent" />
        <text :x="menu.x + 10" :y="menu.y + 4 + i * ITEM_H + 12.5" font-size="10" class="fill-foreground">{{ it }}</text>
      </g>
    </g>

    <circle v-if="hold" :key="`h${hold}`" :cx="cur.x" :cy="cur.y" r="4" fill="none" class="tour-hold stroke-amber-500" stroke-width="2.5" />
    <circle :key="ping" :cx="cur.x" :cy="cur.y" r="3" fill="none" class="tour-ping stroke-sky-500" stroke-width="2" />
    <!-- touch: a finger dot; desktop: a mouse arrow -->
    <circle v-if="m" :cx="cur.x" :cy="cur.y" :r="press ? 11 : 9" class="fill-sky-500/40 stroke-sky-500" stroke-width="1.5" />
    <g v-else :transform="`translate(${cur.x} ${cur.y}) scale(${press ? 0.9 : 1})`">
      <path d="M0 0V15L4 11L7 18L10 17L7 10H12Z" fill="black" stroke="white" stroke-width="1.2" stroke-linejoin="round" />
    </g>
  </svg>
</template>

<style scoped>
.tour-ping { animation: tour-ping 0.6s ease-out forwards; opacity: 0; }
@keyframes tour-ping { from { r: 3px; opacity: 1; } to { r: 16px; opacity: 0; } }
.tour-hold { animation: tour-hold 0.6s linear forwards; opacity: 0; }
@keyframes tour-hold { from { r: 4px; opacity: 1; } to { r: 22px; opacity: 0.2; } }
</style>
