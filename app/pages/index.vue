<script setup lang="ts">
const colorMode = useColorMode()
const toggle = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center gap-4">
    <Button>Test button</Button>
    <Button variant="outline" size="icon" aria-label="Toggle theme" @click="toggle">
      <ClientOnly>
        <Icon :name="colorMode.value === 'dark' ? 'lucide:sun' : 'lucide:moon'" />
      </ClientOnly>
    </Button>
  </main>
</template>
