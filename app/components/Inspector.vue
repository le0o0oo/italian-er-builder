<script setup lang="ts">
import type { Card } from '~/types/er'

const { diagram, selected, remove, addLink } = useDiagram()
const { label } = useShortcuts()
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
    <div v-if="!selected" class="space-y-3 text-sm text-muted-foreground">
      <p class="font-medium text-foreground">Nothing selected</p>
      <p>Select an element to edit it. Drag elements to move them, drag the background to pan, scroll to zoom.</p>
      <ul class="list-disc space-y-1 pl-4">
        <li>Double-click the canvas to add an entity</li>
        <li>Use <b>Connect</b> in the toolbar, then click a relationship and an entity to link them</li>
        <li>Right-click any element or the background for quick actions</li>
        <li>Keyboard shortcuts (rename, add attribute…) can be viewed and remapped from the keyboard icon in the toolbar</li>
      </ul>
    </div>

    <template v-else>
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold capitalize">{{ selected.kind }}</p>
        <Button size="xs" variant="destructive" @click="remove(selected.id)">
          <Icon name="lucide:trash-2" /> Delete
          <kbd v-if="label('delete')" class="ml-1 rounded bg-background/40 px-1 font-mono text-[10px]">{{ label('delete') }}</kbd>
        </Button>
      </div>

      <!-- Entity -->
      <template v-if="selected.kind === 'entity'">
        <div class="space-y-1.5">
          <Label for="name">Name</Label>
          <Input id="name" v-model="selected.name" />
        </div>
        <AttributeList :node="selected" />

        <p class="rounded-md bg-muted px-2 py-1.5 text-xs">
          <span class="font-medium">Primary key:</span>
          <span v-if="primaryKey"> {{ primaryKey }}</span>
          <span v-else class="text-muted-foreground"> none — mark attributes with the key button</span>
          <span v-if="primaryKey.includes('+')" class="block text-muted-foreground">Composite: the marked items together identify the entity (joined by a curve).</span>
        </p>

        <div class="space-y-2">
          <Label>Identified by relationships</Label>
          <p v-if="!identifyingLinks.length" class="text-xs text-muted-foreground">Connect this entity to a relationship to use it as (part of) the identifier.</p>
          <label v-for="{ rel, link } in identifyingLinks" :key="link.id" class="flex items-center gap-2 text-sm">
            <Checkbox :model-value="link.identifying" @update:model-value="link.identifying = $event === true" />
            <span class="truncate">{{ rel.name }}</span>
            <span class="ml-auto text-xs text-muted-foreground">({{ link.card }})</span>
          </label>
          <p class="text-xs text-muted-foreground">Tick several to make the relationships together (optionally with identifier attributes) the primary key — they're joined by a curve.</p>
        </div>
      </template>

      <!-- Relationship -->
      <template v-else-if="selected.kind === 'relationship'">
        <div class="space-y-1.5">
          <Label for="name">Name</Label>
          <Input id="name" v-model="selected.name" />
        </div>

        <div class="space-y-2">
          <Label>Connections (min, max)</Label>
          <p v-if="!selected.links.length" class="text-xs text-muted-foreground">Not connected to any entity.</p>
          <div v-for="(l, i) in selected.links" :key="l.id" class="flex items-center gap-1">
            <span class="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-sm">{{ entityName(l.entityId) }}</span>
            <Select :model-value="l.card" @update:model-value="l.card = $event as Card">
              <SelectTrigger class="h-8 w-[78px] px-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="c in cards" :key="c" :value="c">({{ c }})</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon-sm" :variant="l.identifying ? 'default' : 'outline'" title="External identifier (filled dot)" @click="l.identifying = !l.identifying">
              <Icon name="lucide:circle-dot" />
            </Button>
            <Button size="icon-sm" variant="ghost" title="Remove connection" @click="selected.links.splice(i, 1)">
              <Icon name="lucide:x" />
            </Button>
          </div>
          <div class="flex items-center gap-1">
            <Select v-model="newLinkEntity">
              <SelectTrigger class="h-8 flex-1"><SelectValue placeholder="Connect an entity…" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="e in diagram.entities" :key="e.id" :value="e.id">{{ e.name }}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon-sm" variant="outline" :disabled="!newLinkEntity" @click="addLinkFromSelect">
              <Icon name="lucide:plus" />
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">Connect the same entity twice for a recursive relationship.</p>
        </div>

        <AttributeList :node="selected" />
      </template>

      <!-- Generalization -->
      <template v-else>
        <div class="space-y-1.5">
          <Label>Parent entity</Label>
          <Select :model-value="selected.parentId ?? undefined" @update:model-value="selected.parentId = $event as string; selected.childIds = selected.childIds.filter(c => c !== $event)">
            <SelectTrigger class="w-full"><SelectValue placeholder="Choose the parent…" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="e in diagram.entities" :key="e.id" :value="e.id">{{ e.name }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-1.5">
          <Label>Coverage</Label>
          <Select :model-value="selected.total ? 'total' : 'partial'" @update:model-value="selected.total = $event === 'total'">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="total">Total (t, filled arrow)</SelectItem>
              <SelectItem value="partial">Partial (p, empty arrow)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-1.5">
          <Label>Overlap</Label>
          <Select :model-value="selected.exclusive === false ? 's' : 'e'" @update:model-value="selected.exclusive = $event === 'e'">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="e">Exclusive (e): an instance is in at most one child</SelectItem>
              <SelectItem value="s">Overlapping — sovrapposta (s)</SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">Notation shown on the diagram: ({{ selected.total ? 't' : 'p' }},{{ selected.exclusive === false ? 's' : 'e' }})</p>
        </div>
        <div class="space-y-2">
          <Label>Child entities</Label>
          <p v-if="!diagram.entities.length" class="text-xs text-muted-foreground">Add entities first.</p>
          <label v-for="e in diagram.entities.filter(x => x.id !== selected!.parentId)" :key="e.id" class="flex items-center gap-2 text-sm">
            <Checkbox :model-value="(selected as any).childIds.includes(e.id)" @update:model-value="toggleChild(selected as any, e.id, $event)" />
            {{ e.name }}
          </label>
        </div>
      </template>
    </template>
  </div>
</template>
