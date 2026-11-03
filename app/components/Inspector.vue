<script setup lang="ts">
import type { Card } from '~/types/er'

const { diagram, selected, remove, addLink, select } = useDiagram()
const { label } = useShortcuts()
const { byNode } = useWarnings()
const { byNode: hinted, setRule } = useHints()
const { t } = useT()
const cards: Card[] = ['0,1', '1,1', '0,N', '1,N']
const entityName = (id: string) => diagram.value.entities.find(e => e.id === id)?.name ?? '?'

const identifyingLinks = computed(() => {
  const sel = selected.value
  if (sel?.kind !== 'entity') return []
  return diagram.value.relationships.flatMap(r => r.links.filter(l => l.entityId === sel.id).map(l => ({ rel: r, link: l })))
})

const primaryKey = computed(() => {
  const sel = selected.value
  if (sel?.kind !== 'entity') return ''
  const parts = sel.attributes.filter(a => a.identifier).map(a => a.name)
  const rels = diagram.value.relationships.filter(r => r.links.some(l => l.entityId === sel.id && l.identifying)).map(r => r.name)
  return [...parts, ...rels].join(' + ')
})

const newLinkEntity = ref('')
function addLinkFromSelect() {
  if (selected.value?.kind === 'relationship' && newLinkEntity.value) {
    addLink(selected.value.id, newLinkEntity.value)
    newLinkEntity.value = ''
  }
}
function toggleChild(g: { childIds: string[] }, id: string, on: boolean | 'indeterminate') {
  g.childIds = on === true ? [...new Set([...g.childIds, id])] : g.childIds.filter(c => c !== id)
}
</script>

<template>
  <div class="space-y-5 p-4">
    <template v-if="selected">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold">{{ t(`insp.${selected.kind}`) }}</p>
        <Button size="xs" variant="destructive" class="ml-auto mr-1" @click="remove(selected.id)">
          <Icon name="lucide:trash-2" /> {{ t('insp.delete') }}
          <kbd v-if="label('delete')" class="ml-1 rounded bg-background/40 px-1 font-mono text-[10px]">{{ label('delete') }}</kbd>
        </Button>
        <Button size="icon-xs" variant="ghost" :title="t('insp.close')" @click="select(null)"><Icon name="lucide:x" /></Button>
      </div>

      <ul v-if="byNode[selected.id]?.length" class="space-y-1 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400">
        <li v-for="w in byNode[selected.id]" :key="w.id" class="flex items-start gap-1.5"><Icon name="lucide:triangle-alert" class="mt-0.5 shrink-0" /> {{ w.message }}</li>
      </ul>

      <ul v-if="hinted[selected.id]?.length" class="space-y-1 rounded-md bg-sky-500/10 px-2 py-1.5 text-xs text-sky-700 dark:text-sky-400">
        <li v-for="h in hinted[selected.id]" :key="h.id" class="flex items-start gap-1.5">
          <Icon name="lucide:lightbulb" class="mt-0.5 shrink-0" />
          <span class="min-w-0 flex-1">{{ h.message }}</span>
          <Tip :text="t('hint.turnOff')" side="left">
            <Button variant="outline" size="icon" class="size-6 shrink-0 border-sky-500/40 bg-background/60 text-sky-700 hover:border-sky-500 hover:bg-sky-500/20 hover:text-sky-700 dark:text-sky-400" :aria-label="t('hint.turnOff')" @click="setRule(h.ruleId, false)"><Icon name="lucide:eye-off" class="size-3.5" /></Button>
          </Tip>
        </li>
      </ul>

      <!-- Entity -->
      <template v-if="selected.kind === 'entity'">
        <div class="space-y-1.5">
          <Label for="name">{{ t('insp.name') }}</Label>
          <Input id="name" v-model="selected.name" />
        </div>
        <AttributeList :node="selected" />

        <p class="rounded-md bg-muted px-2 py-1.5 text-xs">
          <span class="font-medium">{{ t('insp.pk') }}</span>
          <span v-if="primaryKey"> {{ primaryKey }}</span>
          <span v-else class="text-muted-foreground">{{ t('insp.pkNone') }}</span>
        </p>

        <div class="space-y-2">
          <Label>{{ t('insp.identifiedBy') }}</Label>
          <p v-if="!identifyingLinks.length" class="text-xs text-muted-foreground">{{ t('insp.identifiedByEmpty') }}</p>
          <label v-for="{ rel, link } in identifyingLinks" :key="link.id" class="flex items-center gap-2 text-sm">
            <Checkbox :model-value="link.identifying" @update:model-value="link.identifying = $event === true" />
            <span class="truncate">{{ rel.name }}</span>
            <span class="ml-auto text-xs text-muted-foreground">({{ link.card }})</span>
          </label>
          <p class="text-xs text-muted-foreground">{{ t('insp.identifiedByHelp') }}</p>
        </div>
      </template>

      <!-- Relationship -->
      <template v-else-if="selected.kind === 'relationship'">
        <div class="space-y-1.5">
          <Label for="name">{{ t('insp.name') }}</Label>
          <Input id="name" v-model="selected.name" />
        </div>

        <div class="space-y-2">
          <Label>{{ t('insp.connections') }}</Label>
          <p v-if="!selected.links.length" class="text-xs text-muted-foreground">{{ t('insp.notConnected') }}</p>
          <div v-for="(l, i) in selected.links" :key="l.id" class="flex items-center gap-1">
            <span class="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-sm">{{ entityName(l.entityId) }}</span>
            <Select :model-value="l.card" @update:model-value="l.card = $event as Card">
              <SelectTrigger class="h-8 w-[78px] px-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="c in cards" :key="c" :value="c">({{ c }})</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon-sm" :variant="l.identifying ? 'default' : 'outline'" :title="t('insp.externalId')" @click="l.identifying = !l.identifying">
              <Icon name="lucide:circle-dot" />
            </Button>
            <Button size="icon-sm" variant="ghost" :title="t('insp.removeConnection')" @click="selected.links.splice(i, 1)">
              <Icon name="lucide:x" />
            </Button>
          </div>
          <div class="flex items-center gap-1">
            <Select v-model="newLinkEntity">
              <SelectTrigger class="h-8 flex-1"><SelectValue :placeholder="t('insp.connectEntity')" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="e in diagram.entities" :key="e.id" :value="e.id">{{ e.name }}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon-sm" variant="outline" :disabled="!newLinkEntity" @click="addLinkFromSelect">
              <Icon name="lucide:plus" />
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">{{ t('insp.recursive') }}</p>
        </div>

        <AttributeList :node="selected" />
      </template>

      <!-- Generalization -->
      <template v-else>
        <div class="space-y-1.5">
          <Label>{{ t('insp.parent') }}</Label>
          <Select :model-value="selected.parentId ?? undefined" @update:model-value="selected.parentId = $event as string; selected.childIds = selected.childIds.filter(c => c !== $event)">
            <SelectTrigger class="w-full"><SelectValue :placeholder="t('insp.chooseParent')" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="e in diagram.entities" :key="e.id" :value="e.id">{{ e.name }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-1.5">
          <Label>{{ t('insp.coverage') }}</Label>
          <Select :model-value="selected.total ? 'total' : 'partial'" @update:model-value="selected.total = $event === 'total'">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="total">{{ t('insp.total') }}</SelectItem>
              <SelectItem value="partial">{{ t('insp.partial') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-1.5">
          <Label>{{ t('insp.overlap') }}</Label>
          <Select :model-value="selected.exclusive === false ? 's' : 'e'" @update:model-value="selected.exclusive = $event === 'e'">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="e">{{ t('insp.exclusive') }}</SelectItem>
              <SelectItem value="s">{{ t('insp.overlapping') }}</SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">{{ t('insp.notation', { n: `(${selected.total ? 't' : 'p'},${selected.exclusive === false ? 's' : 'e'})` }) }}</p>
        </div>
        <div class="space-y-2">
          <Label>{{ t('insp.children') }}</Label>
          <p v-if="!diagram.entities.length" class="text-xs text-muted-foreground">{{ t('insp.addEntitiesFirst') }}</p>
          <label v-for="e in diagram.entities.filter(x => x.id !== selected!.parentId)" :key="e.id" class="flex items-center gap-2 text-sm">
            <Checkbox :model-value="(selected as any).childIds.includes(e.id)" @update:model-value="toggleChild(selected as any, e.id, $event)" />
            {{ e.name }}
          </label>
        </div>
      </template>
    </template>
  </div>
</template>
