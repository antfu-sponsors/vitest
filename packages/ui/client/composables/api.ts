import type { BrowserUI } from 'vitest'
import { findById } from './client'
import { viewport } from './browser'

export const ui: BrowserUI = {
  setCurrentFileId(fileId: string) {
    activeFileId.value = fileId
    currentModule.value = findById(fileId)
    showDashboard(false)
  },
  async setIframeViewport(width: number, height: number) {
    // reset the button before setting a custom viewport
    viewport.value = [width, height]
    await new Promise(r => requestAnimationFrame(r))
  },
}
