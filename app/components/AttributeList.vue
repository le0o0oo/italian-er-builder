<script setup lang="ts">
import type { Card, Entity, Relationship } from '~/types/er'

defineProps<{ node: Entity | Relationship }>()
const { addAttribute } = useDiagram()
const { label } = useShortcuts()
const cards: Card[] = ['1,1', '0,1', '1,N', '0,N']
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <Label>Attributes</Label>
      <Button size="xs" variant="outline" @click="addAttribute(node)">
        <Icon name="lucide:plus" /> Add
        <kbd v-if="label('addAttribute')" class="rounded bg-muted px-1 font-mono text-[10px]">{{ label('addAttribute') }}</kbd>
      </Button>
    </div>
    <p v-if="!node.attributes.length" class="text-xs text-muted-foreground">No attributes yet.</p>
    <div v-for="(a, i) in node.attributes" :key="a.id" class="flex items-center gap-1">
      <Input :id="`attr-${a.id}`" v-model="a.name" class="h-8 min-w-0 flex-1" />
      <Select :model-value="a.card" @update:model-value="a.card = $event as Card">
        <SelectTrigger class="h-8 w-[78px] px-2" title="Attribute cardinality">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="c in cards" :key="c" :value="c">({{ c }})</SelectItem>
        </SelectContent>
      </Select>
      <Button size="icon-sm" :variant="a.identifier ? 'default' : 'outline'" title="Part of the primary key. Several marked attributes form one composite key" @click="a.identifier = !a.identifier">
        <Icon name="lucide:key-round" />
      </Button>
      <Button size="icon-sm" variant="ghost" title="Remove attribute" @click="node.attributes.splice(i, 1)">
        <Icon name="lucide:x" />
      </Button>
    </div>
  </div>
</template>
