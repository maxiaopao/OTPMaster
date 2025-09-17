import { EventEmitter } from 'events'
import { clipboard } from 'electron'
import type { AutomationResult } from '@shared/types'

export class AutomationService extends EventEmitter {
  constructor() {
    super()
  }

  public async copyToClipboard(text: string): Promise<AutomationResult> {
    try {
      clipboard.writeText(text)
      console.log(`已复制到剪贴板: ${text}`)
      
      return {
        success: true,
        action: 'copy',
      }
    } catch (error) {
      const errorMessage = `复制到剪贴板失败: ${error}`
      console.error(errorMessage)
      
      return {
        success: false,
        action: 'copy',
        error: errorMessage,
      }
    }
  }

  public async executeAutoSequence(verificationCode: string): Promise<void> {
    try {
      // 只复制到剪贴板
      const copyResult = await this.copyToClipboard(verificationCode)
      if (!copyResult.success) {
        throw new Error(copyResult.error)
      }

      console.log(`验证码已复制到剪贴板: ${verificationCode}`)
    } catch (error) {
      console.error('复制验证码失败:', error)
      throw error
    }
  }
}