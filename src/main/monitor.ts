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
      // 设置初始时间为30分钟前，这样可以捕获最近的短信但避免处理太老的历史消息
      this.lastCheckTime = new Date(Date.now() - 30 * 60 * 1000) // 30分钟前
      
      await this.initializeMonitoring()
      this.isMonitoring = true
      console.log('✅ 短信监控已启动')
      console.log('⚙️ 监控最近30分钟内的新短信')
      console.log('📈 监控间隔：1秒 (高速响应模式)')
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
    }, 1000) // 每1秒检查一次，提高响应速度
  }

  private async checkForNewMessages(): Promise<void> {
    if (!this.useRealDatabase || !this.database) {
      return
    }

    try {
      const startTime = Date.now()
      const now = new Date()
      // 查询最近2分钟的消息，减少查询范围提高速度
      const lookbackTime = new Date(now.getTime() - 2 * 60 * 1000)
      const messages = await this.queryRecentMessagesAsync(lookbackTime)
      
      // 只处理真正的新消息（时间戳大于lastCheckTime）
      const newMessages = messages.filter(message => message.timestamp > this.lastCheckTime)
      
      if (newMessages.length > 0) {
        console.log(`🔍 发现 ${newMessages.length} 条新消息`)
      }
      
      for (const message of newMessages) {
        const codeStartTime = Date.now()
        const verificationCode = extractVerificationCode(message.text, message.sender)
        
        if (verificationCode) {
          const messageKey = `${message.id}_${message.timestamp.getTime()}`
          
          if (!this.processedMessages.has(messageKey)) {
            this.processedMessages.add(messageKey)
            
            try {
              // 立即复制，不等待
              this.automationService.copyToClipboard(verificationCode.code)
              const processingTime = Date.now() - codeStartTime
              
              console.log('✅ 验证码已复制:', verificationCode.code)
              console.log('📱 消息来源:', message.sender)
              console.log('⏰ 消息时间:', message.timestamp.toLocaleString())
              console.log(`⚡ 处理耗时: ${processingTime}ms`)
            } catch (error) {
              console.error('复制失败:', error)
            }
          }
        }
      }

      // 只有处理了新消息后才更新lastCheckTime
      if (newMessages.length > 0) {
        this.lastCheckTime = now
        const totalTime = Date.now() - startTime
        console.log(`🔄 更新检查时间: ${now.toLocaleString()} (总耗时: ${totalTime}ms)`)
      }
    } catch (error) {
      console.error('检查消息失败:', error)
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
      LIMIT 10
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