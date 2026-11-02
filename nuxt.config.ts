import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/icon/module', '@nuxt/image', 'shadcn-nuxt', '@nuxtjs/color-mode'],
  css: ['~/assets/css/tailwind.css'],
  vite: { plugins: [tailwindcss()] },
  colorMode: { classSuffix: '' },
  shadcn: { prefix: '', componentDir: './app/components/ui' },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true }
})
