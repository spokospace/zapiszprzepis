import { buttonClasses } from '@/app/components/ui/button'

// Design tokens (WCAG 2.2 AA, E01-S12b): 2px field border at 3:1, 56px fields.
// Shared by the 3a sign-in form and /signup.
export const LABEL = 'text-[17px] font-bold text-ink'
export const INPUT =
  'min-h-[56px] w-full rounded-field border-2 border-field bg-white px-4 text-[19px] text-ink placeholder:text-ink-muted disabled:bg-surface-3 disabled:text-ink-muted'
export const SUBMIT = `${buttonClasses('primary', 'lg')} mt-2 w-full text-[19px]`
export const NOTICE = 'mt-4 rounded-field border-2 px-4 py-3 text-[17px]'
