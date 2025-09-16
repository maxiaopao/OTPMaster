import { EventEmitter } from 'events'
import { clipboard } from 'electron'
import { ConfigManager } from './config'
import { AutomationResult } from '@shared/types'
import { AUTOMATION } from '@shared/constants'
import { delay } from '@shared/utils'

export class AutomationService extends EventEmitter {
  constructor(private configManager: ConfigManager) {
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

  public async simulatePaste(): Promise<AutomationResult> {
    try {
      // 注意：在实际使用中，需要使用如 robotjs 或 @nut-tree/nut-js 等自动化库
      // 这里仅作为演示，实际部署时需要正确的自动化实现
      console.log('模拟粘贴操作 (Cmd+V/Ctrl+V)')
      
      return {
        success: true,
        action: 'paste',
      }
    } catch (error) {
      const errorMessage = `粘贴操作失败: ${error}`
      console.error(errorMessage)
      
      return {
        success: false,
        action: 'paste',
        error: errorMessage,
      }
    }
  }

  public async simulateEnter(): Promise<AutomationResult> {
    try {
      // 注意：在实际使用中，需要使用如 robotjs 或 @nut-tree/nut-js 等自动化库
      // 这里仅作为演示，实际部署时需要正确的自动化实现
      console.log('模拟回车操作 (Enter)')
      
      return {
        success: true,
        action: 'enter',
      }
    } catch (error) {
      const errorMessage = `回车操作失败: ${error}`
      console.error(errorMessage)
      
      return {
        success: false,
        action: 'enter',
        error: errorMessage,
      }
    }
  }

  public async executeAutoSequence(verificationCode: string): Promise<void> {
    const config = this.configManager.getConfig()
    
    try {
      // 第一步：复制到剪贴板
      const copyResult = await this.copyToClipboard(verificationCode)
      if (!copyResult.success) {
        throw new Error(copyResult.error)
      }

      // 如果启用了自动粘贴
      if (config.settings.auto_paste) {
        await delay(AUTOMATION.ACTION_DELAY)
        
        const pasteResult = await this.simulatePaste()
        if (!pasteResult.success) {
          throw new Error(pasteResult.error)
        }

        // 如果启用了自动回车
        if (config.settings.auto_return) {
          await delay(AUTOMATION.ACTION_DELAY)
          
          const enterResult = await this.simulateEnter()
          if (!enterResult.success) {
            throw new Error(enterResult.error)
          }
        }
      }

      console.log(`自动化序列执行完成: ${verificationCode}`)
    } catch (error) {
      console.error('自动化序列执行失败:', error)
      throw error
    }
  }
}