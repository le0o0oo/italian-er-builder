import en from '~/i18n/en'
import it from '~/i18n/it'

export type Locale = 'en' | 'it'
export const LOCALES: { code: Locale, label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
]
const messages: Record<Locale, Record<string, string>> = { en, it }

export type Translate = (key: string, params?: Record<string, string | number>) => string

export function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const s = messages[locale]?.[key] ?? en[key] ?? key
  return params ? s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? '')) : s
}
