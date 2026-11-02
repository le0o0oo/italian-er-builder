import type { Locale, Translate } from '~/utils/i18n'

/** Language preference, stored in a cookie so server and client render the same language. */
export function useLocale() {
  const headers = useRequestHeaders(['accept-language'])
  return useCookie<Locale>('er-lang', {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    default: () => {
      const accept = import.meta.server ? headers['accept-language'] : navigator.language
      return accept?.toLowerCase().startsWith('it') ? 'it' : 'en'
    },
  })
}

export function useT() {
  const locale = useLocale()
  const t: Translate = (key, params) => translate(locale.value === 'it' ? 'it' : 'en', key, params)
  return { t, locale }
}
