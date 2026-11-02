<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ pick: [id: string] }>()
const { diagram } = useDiagram()
const { t } = useT()

const entities = computed(() => diagram.value.entities.map(e => ({
  id: e.id, label: e.name, detail: `${e.attributes.length} ${t('attr.title').toLowerCase()}`,
})))
const relationships = computed(() => diagram.value.relationships.map(r => ({
  id: r.id, label: r.name,
  detail: r.links.map(l => diagram.value.entities.find(e => e.id === l.entityId)?.name).filter(Boolean).join(' – '),
})))
const generalizations = computed(() => diagram.value.generalizations.map((g, i) => {
  const parent = diagram.value.entities.find(e => e.id === g.parentId)
  const kids = g.childIds.map(id => diagram.value.entities.find(e => e.id === id)?.name).filter(Boolean)
  return { id: g.id, label: parent ? t('msg.genOf', { name: parent.name }) : t('msg.genN', { n: i + 1 }), detail: kids.join(', ') }
}))
const attributes = computed(() => [...diagram.value.entities, ...diagram.value.relationships].flatMap(n =>
  n.attributes.map(a => ({ id: n.id, key: `${n.id}-${a.id}`, label: a.name, detail: t('search.attributeOf', { name: n.name }) })),
))

function pick(id: string) {
  emit('pick', id)
  open.value = false
}
</script>

<template>
  <CommandDialog v-model:open="open" :title="t('tip.search')" :description="t('search.placeholder')">
    <CommandInput :placeholder="t('search.placeholder')" />
    <CommandList>
      <CommandEmpty>{{ t('search.empty') }}</CommandEmpty>
      <CommandGroup v-if="entities.length" :heading="t('search.entities')">
        <CommandItem v-for="e in entities" :key="e.id" :value="`${e.label} ${e.id}`" @select="pick(e.id)">
          <Icon name="lucide:square" /> <span>{{ e.label }}</span> <span class="ml-auto text-xs text-muted-foreground">{{ e.detail }}</span>
        </CommandItem>
      </CommandGroup>
      <CommandGroup v-if="relationships.length" :heading="t('search.relationships')">
        <CommandItem v-for="r in relationships" :key="r.id" :value="`${r.label} ${r.detail} ${r.id}`" @select="pick(r.id)">
          <Icon name="lucide:diamond" /> <span>{{ r.label }}</span> <span class="ml-auto truncate text-xs text-muted-foreground">{{ r.detail }}</span>
        </CommandItem>
      </CommandGroup>
      <CommandGroup v-if="generalizations.length" :heading="t('search.generalizations')">
        <CommandItem v-for="g in generalizations" :key="g.id" :value="`${g.label} ${g.detail} ${g.id}`" @select="pick(g.id)">
          <Icon name="lucide:triangle" /> <span>{{ g.label }}</span> <span class="ml-auto truncate text-xs text-muted-foreground">{{ g.detail }}</span>
        </CommandItem>
      </CommandGroup>
      <CommandGroup v-if="attributes.length" :heading="t('search.attributes')">
        <CommandItem v-for="a in attributes" :key="a.key" :value="`${a.label} ${a.detail} ${a.key}`" @select="pick(a.id)">
          <Icon name="lucide:circle" /> <span>{{ a.label }}</span> <span class="ml-auto truncate text-xs text-muted-foreground">{{ a.detail }}</span>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
