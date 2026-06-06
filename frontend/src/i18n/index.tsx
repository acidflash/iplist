import React, { createContext, useContext, useState } from 'react'
import type { Translations } from './types'
import sv from './sv'
import en from './en'

export type { Translations }

/** Map of all registered languages. Add new languages here. */
export const langs: Record<string, Translations> = { sv, en }

const STORAGE_KEY = 'iplist_lang'

function getInitialLang(): string {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && saved in langs) return saved
  const browser = navigator.language.split('-')[0]
  if (browser in langs) return browser
  return 'sv'
}

interface I18nContextValue {
  t: Translations
  lang: string
  setLang: (lang: string) => void
  langs: Record<string, Translations>
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<string>(getInitialLang)

  function setLang(l: string) {
    if (l in langs) {
      localStorage.setItem(STORAGE_KEY, l)
      setLangState(l)
    }
  }

  return (
    <I18nContext.Provider value={{ t: langs[lang], lang, setLang, langs }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useT() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used inside I18nProvider')
  return ctx
}
