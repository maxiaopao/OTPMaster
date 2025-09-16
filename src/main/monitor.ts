import { EventEmitter } from 'events'
import { homedir } from 'os'
import { join } from 'path'
import { watch, FSWatcher } from 'chokidar'
import Database from 'better-sqlite3'
import { ConfigManager } from './config'
import { PermissionManager } from './permissions'
import { AutomationService } from './automation'
import { SMSMessage, VerificationCode } from '@shared/types'
import { DATABASE } from '@shared/constants'
import { extractVerificationCode } from '@shared/utils'

export class SMSMonitor extends EventEmitter {
  private db: Database.Database | null = null
  private watcher: FSWatcher | null = null
  private isMonitoring = false
  private lastCheckTime = new Date()

  constructor(
    private configManager: ConfigManager,
    private permissionManager: PermissionManager,
    private automationService: AutomationService
  ) {
    super()
  }

  public async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('短信监控已在运行')
      return
    }

    try {
      await this.initializeDatabase()
      this.setupFileWatcher()
      this.isMonitoring = true
      
      console.log('短信监控已启动')
    } catch (error) {
      console.error('启动短信监控失败:', error)
      throw error
    }
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    this.cleanup()
    this.isMonitoring = false
    console.log('短信监控已停止')
  }

  private async initializeDatabase(): Promise<void> {
    const dbPath = join(homedir(), 'Library/Messages/chat.db')
    
    try {
      this.db = new Database(dbPath, { readonly: true })
      console.log('Messages 数据库连接成功')
    } catch (error) {
      throw new Error(`无法连接到 Messages 数据库: ${error}`)
    }
  }

  private setupFileWatcher(): void {
    const walPath = join(homedir(), 'Library/Messages/chat.db-wal')
    
    this.watcher = watch(walPath, {
      persistent: true,
      ignoreInitial: true,
    })

    this.watcher.on('change', () => {
      this.checkForNewMessages()
    })

    console.log('文件监控已设置')
  }

  private async checkForNewMessages(): Promise<void> {
    if (!this.db) return

    try {
      const config = this.configManager.getConfig()
      const lookbackTime = new Date(
        Date.now() - config.monitoring.message_lookback_minutes * 60 * 1000
      )

      const messages = this.queryRecentMessages(lookbackTime)
      
      for (const message of messages) {
        const verificationCode = extractVerificationCode(message.text, message.sender)
        
        if (verificationCode) {
          console.log('发现验证码:', verificationCode)
          
          // 触发验证码提取事件
          this.emit('verification-code-extracted', verificationCode)
          
          // 执行自动化操作
          try {
            await this.automationService.executeAutoSequence(verificationCode.code)
          } catch (error) {
            console.error('自动化操作失败:', error)
          }
        }
      }

      this.lastCheckTime = new Date()
    } catch (error) {
      console.error('检查新消息失败:', error)
    }
  }

  private queryRecentMessages(since: Date): SMSMessage[] {
    if (!this.db) return []

    try {
      const query = `
        SELECT 
          m.ROWID as id,
          m.text,
          m.date,
          m.guid,
          h.id as sender
        FROM ${DATABASE.MESSAGE_TABLE} m
        LEFT JOIN ${DATABASE.HANDLE_TABLE} h ON m.handle_id = h.ROWID
        WHERE m.date > ? 
          AND m.text IS NOT NULL 
          AND m.text != ''
          AND m.is_from_me = 0
        ORDER BY m.date DESC
        LIMIT 50
      `

      // Messages 数据库中的时间戳是从 2001-01-01 开始的秒数
      const macTimestamp = since.getTime() / 1000 - 978307200

      const stmt = this.db.prepare(query)
      const rows = stmt.all(macTimestamp)

      return rows.map(row => ({
        id: String(row.id),
        text: row.text || '',
        sender: row.sender || 'Unknown',
        timestamp: new Date((row.date + 978307200) * 1000),
        guid: row.guid || '',
      }))
    } catch (error) {
      console.error('查询消息失败:', error)
      return []
    }
  }

  private cleanup(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }

    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  public isRunning(): boolean {
    return this.isMonitoring
  }
}