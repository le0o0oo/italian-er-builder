<script setup lang="ts">
const { t } = useT()
useSeo({ title: () => t('guide.seoTitle'), description: () => t('guide.seoDesc') })
const cards = [
  { code: '(0,1)', key: 'guide.card.01' },
  { code: '(1,1)', key: 'guide.card.11' },
  { code: '(0,N)', key: 'guide.card.0N' },
  { code: '(1,N)', key: 'guide.card.1N' },
]
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-10 px-5 py-12">
    <nav class="flex items-center justify-between text-sm">
      <NuxtLink to="/" class="flex items-center gap-2 font-semibold"><Icon name="lucide:git-fork" /> ER Maker</NuxtLink>
      <Button as-child size="sm"><NuxtLink to="/">{{ t('guide.open') }}</NuxtLink></Button>
    </nav>

    <header class="space-y-3">
      <h1 class="text-3xl font-bold tracking-tight">{{ t('guide.h1') }}</h1>
      <p class="text-muted-foreground">{{ t('guide.intro') }}</p>
    </header>

    <section class="space-y-2">
      <h2 class="text-xl font-semibold">{{ t('guide.entities') }}</h2>
      <p>{{ t('guide.entitiesText') }}</p>
    </section>

    <section class="space-y-2">
      <h2 class="text-xl font-semibold">{{ t('guide.relationships') }}</h2>
      <p>{{ t('guide.relationshipsText') }}</p>
    </section>

    <section class="space-y-2">
      <h2 class="text-xl font-semibold">{{ t('guide.attributes') }}</h2>
      <p>{{ t('guide.attributesText1') }}</p>
      <p>{{ t('guide.attributesText2') }}</p>
    </section>

    <section class="space-y-3">
      <h2 class="text-xl font-semibold">{{ t('guide.cards') }}</h2>
      <p>{{ t('guide.cardsText') }}</p>
      <ul class="grid gap-2 sm:grid-cols-2">
        <li v-for="c in cards" :key="c.code" class="rounded-lg border p-3">
          <code class="font-semibold">{{ c.code }}</code>
          <p class="text-sm text-muted-foreground">{{ t(c.key) }}</p>
        </li>
      </ul>
    </section>

    <section class="space-y-2">
      <h2 class="text-xl font-semibold">{{ t('guide.generalizations') }}</h2>
      <p>{{ t('guide.generalizationsText1') }}</p>
      <p>{{ t('guide.generalizationsText2') }}</p>
    </section>

    <section class="space-y-2">
      <h2 class="text-xl font-semibold">{{ t('guide.try') }}</h2>
      <p>{{ t('guide.tryText') }}</p>
      <Button as-child><NuxtLink to="/">{{ t('guide.start') }}</NuxtLink></Button>
    </section>
  </main>
</template>
