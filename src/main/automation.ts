import { clipboard } from 'electron'
import type { AutomationResult } from '@shared/types'

export class AutomationService {
  public async copyToClipboard(text: string): Promise<AutomationResult> {
    try {
      clipboard.writeText(text)
      return { success: true, action: 'copy' }
    } catch (error) {
      return {
        success: false,
        action: 'copy',
        error: String(error)
      }
    }
  }

  public async executeAutoSequence(verificationCode: string): Promise<void> {
    const result = await this.copyToClipboard(verificationCode)
    if (!result.success) {
      throw new Error(result.error)
    }
  }
}