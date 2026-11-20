// Host component (not upstream): Light / Dark / System switch for VidBee's own title bar.
// Drives upstream's theme machinery unchanged: next-themes applies the class, and the choice is saved as upstream's `theme` setting
// (same call as Settings → Theme), so both stay in sync.
import { Button } from '@renderer/components/ui/button'
import { useSetAtom } from 'jotai'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { saveSettingAtom } from '../../store/settings'

type ThemeChoice = 'light' | 'dark' | 'system'
const ORDER: ThemeChoice[] = ['light', 'dark', 'system']
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const

/**
 * Cycle the theme: light → dark → system.
 */
export function HostThemeToggle() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const saveSetting = useSetAtom(saveSettingAtom)
  const current = (ORDER.includes(theme as ThemeChoice) ? theme : 'system') as ThemeChoice
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]
  const Icon = ICONS[current]
  const label = `${t('settings.theme')}: ${t(`settings.${current}`)}`

  return (
    <Button
      aria-label={label}
      className="h-8 w-8 shrink-0 hover:bg-muted"
      data-theme-toggle=""
      onClick={() => {
        setTheme(next)
        void saveSetting({ key: 'theme', value: next })
      }}
      size="icon"
      title={label}
      type="button"
      variant="ghost"
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}
