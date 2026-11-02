<script setup lang="ts">
const locale = useLocale()
useHead({ htmlAttrs: { lang: () => locale.value } })
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>
