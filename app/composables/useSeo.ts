/** Title, description, canonical URL and social tags for a page (values may be getters, so they follow the language). */
export function useSeo(opts: { title: () => string, description: () => string }) {
  const url = useRequestURL()
  const route = useRoute()
  const canonical = `${url.origin}${route.path}`
  useSeoMeta({
    title: opts.title,
    description: opts.description,
    ogTitle: opts.title,
    ogDescription: opts.description,
    ogType: 'website',
    ogUrl: canonical,
    ogSiteName: 'ER Builder',
    twitterCard: 'summary',
    twitterTitle: opts.title,
    twitterDescription: opts.description,
  })
  useHead({ link: [{ rel: 'canonical', href: canonical }] })
  return { canonical }
}
