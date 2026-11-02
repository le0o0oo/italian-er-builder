import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/icon/module', '@nuxt/image', 'shadcn-nuxt', '@nuxtjs/color-mode'],
  css: ['~/assets/css/tailwind.css'],
  vite: { plugins: [tailwindcss()] },
  colorMode: { classSuffix: '' },
  shadcn: { prefix: '', componentDir: './app/components/ui' },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      meta: [{ name: 'theme-color', content: '#18181b' }],
    },
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true }
})
