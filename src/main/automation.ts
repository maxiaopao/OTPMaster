import { clipboard } from 'electron'
import type { AutomationResult } from '@shared/types'

export class AutomationService {
  public copyToClipboard(text: string): AutomationResult {
    try {
      // 使用同步操作，无需等待
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

  // 保留异步版本以兼容性
  public async copyToClipboardAsync(text: string): Promise<AutomationResult> {
    return this.copyToClipboard(text)
  }

  public async executeAutoSequence(verificationCode: string): Promise<void> {
    const result = this.copyToClipboard(verificationCode)
    if (!result.success) {
      throw new Error(result.error)
    }
  }
}