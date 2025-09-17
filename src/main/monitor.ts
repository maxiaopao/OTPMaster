import { EventEmitter } from 'events'
import { homedir } from 'os'
import { join } from 'path'
import { existsSync } from 'fs'
import * as sqlite3 from 'sqlite3'
import { AutomationService } from './automation'
import type { SMSMessage, VerificationCode } from '@shared/types'
import { extractVerificationCode } from '@shared/utils'

export class SMSMonitor extends EventEmitter {
  private isMonitoring = false
  private lastCheckTime = new Date(0)
  private checkInterval: NodeJS.Timeout | null = null
  private database: sqlite3.Database | null = null
  private useRealDatabase = false
  private processedMessages = new Set<string>()

  constructor(private automationService: AutomationService) {
    super()
  }

  public async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ 短信监控已在运行')
      return
    }

    try {
      // 设置初始时间为当前时间，只监控从现在开始的新短信
      this.lastCheckTime = new Date()
      
      await this.initializeMonitoring()
      this.isMonitoring = true
      console.log('✅ 短信监控已启动')
      console.log('⚙️ 只监控新短信，不处理历史消息')
      console.log('📈 监控间隔：5秒')
    } catch (error) {
      console.error('❌ 启动监控失败:', error)
    }
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    this.cleanup()
    this.isMonitoring = false
  }

  private async initializeMonitoring(): Promise<void> {
    const dbPath = join(homedir(), 'Library/Messages/chat.db')
    
    console.log('📁 正在检查数据库:', dbPath)
    
    if (existsSync(dbPath)) {
      try {
        await this.initializeDatabase(dbPath)
        this.useRealDatabase = true
        console.log('✅ 成功连接Messages数据库')
      } catch (error) {
        this.useRealDatabase = false
        console.log('⚠️ 数据库连接失败，可能缺少权限')
      }
    } else {
      this.useRealDatabase = false
      console.log('❌ 未找到Messages数据库')
    }

    // 设置定期检查 - 每5秒检查一次
    this.setupPeriodicCheck()
  }

  private async initializeDatabase(dbPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.database = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(err)
          return
        }
        
        this.database!.get('SELECT COUNT(*) as count FROM message LIMIT 1', (err) => {
          if (err) {
            reject(err)
            return
          }
          resolve()
        })
      })
    })
  }

  private setupPeriodicCheck(): void {
    this.checkInterval = setInterval(() => {
      this.checkForNewMessages()
    }, 5000) // 每5秒检查一次
  }

  private async checkForNewMessages(): Promise<void> {
    if (!this.useRealDatabase || !this.database) {
      return
    }

    try {
      const now = new Date()
      const lookbackTime = new Date(this.lastCheckTime.getTime() - 30000) // 往前30秒
      const messages = await this.queryRecentMessagesAsync(lookbackTime)
      
      // 只处理真正的新消息（时间戳大于lastCheckTime）
      const newMessages = messages.filter(message => message.timestamp > this.lastCheckTime)
      
      for (const message of newMessages) {
        const verificationCode = extractVerificationCode(message.text, message.sender)
        
        if (verificationCode) {
          const messageKey = `${message.id}_${message.timestamp.getTime()}`
          
          if (!this.processedMessages.has(messageKey)) {
            this.processedMessages.add(messageKey)
            
            try {
              await this.automationService.executeAutoSequence(verificationCode.code)
              console.log('✅ 验证码已复制:', verificationCode.code)
            } catch (error) {
              console.error('复制失败:', error)
            }
          }
        }
      }

      // 更新lastCheckTime以确保下次只处理新消息
      this.lastCheckTime = now
    } catch (error) {
      // 静默处理错误
    }
  }

  private async queryRecentMessagesAsync(since: Date): Promise<SMSMessage[]> {
    if (!this.database) {
      return []
    }

    const query = `
      SELECT 
        m.ROWID as id,
        m.text,
        h.id as sender,
        m.guid,
        m.date/1000000000 + strftime('%s', '2001-01-01') as unix_timestamp
      FROM message m
      JOIN handle h ON m.handle_id = h.ROWID
      WHERE m.text IS NOT NULL 
        AND m.text != ''
        AND m.date/1000000000 + strftime('%s', '2001-01-01') >= ?
      ORDER BY m.date DESC
      LIMIT 50
    `

    const sinceUnixTimestamp = Math.floor(since.getTime() / 1000)

    return new Promise((resolve) => {
      this.database!.all(query, [sinceUnixTimestamp], (err, rows: any[]) => {
        if (err) {
          resolve([])
          return
        }

        const messages = rows.map((row) => ({
          id: String(row.id),
          text: row.text || '',
          sender: row.sender || '',
          timestamp: new Date(row.unix_timestamp * 1000),
          guid: row.guid || ''
        }))

        resolve(messages)
      })
    })
  }

  private cleanup(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    
    if (this.database) {
      this.database.close()
      this.database = null
    }
  }
}