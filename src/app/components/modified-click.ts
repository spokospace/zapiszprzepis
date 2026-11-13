import type { MouseEvent } from 'react'

/** Whether a click should stay with the browser: new tab, download, another button, or already handled. */
export function isModifiedClick(event: MouseEvent<HTMLElement>): boolean {
  return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}
