import { EventEmitter } from 'events'
import { homedir } from 'os'
import { join } from 'path'
import { existsSync } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as sqlite3 from 'sqlite3'
import { ConfigManager } from './config'
import { PermissionManager } from './permissions'
import { AutomationService } from './automation'
import type { SMSMessage, VerificationCode } from '@shared/types'
import { DATABASE } from '@shared/constants'
import { extractVerificationCode } from '@shared/utils'

const execAsync = promisify(exec)

export class SMSMonitor extends EventEmitter {
  private isMonitoring = false
  private lastCheckTime = new Date(0) // 初始设置为1970年，确保首次检查会查看过去1小时
  private checkInterval: NodeJS.Timeout | null = null
  private database: sqlite3.Database | null = null
  private mockMessages: SMSMessage[] = []
  private useRealDatabase = false

  constructor(
    private configManager: ConfigManager,
    private permissionManager: PermissionManager,
    private automationService: AutomationService
  ) {
    super()
    this.initializeMockData()
  }

  // 初始化模拟数据
  private initializeMockData(): void {
    const now = new Date();
    this.mockMessages = [
      {
        id: '1',
        text: '您好，您的验证码是123456，请在5分钟内使用。',
        sender: '+8613800138000',
        timestamp: new Date(now.getTime() - 30000), // 30秒前
        guid: 'mock-guid-1'
      },
      {
        id: '2', 
        text: '欢迎使用我们的服务！',
        sender: '+8613800138001',
        timestamp: new Date(now.getTime() - 120000), // 2分钟前
        guid: 'mock-guid-2'
      },
      {
        id: '3',
        text: '您的手机验证码为：789012，请妥善保管。',
        sender: '+8613800138002',
        timestamp: new Date(now.getTime() - 180000), // 3分钟前
        guid: 'mock-guid-3'
      },
      {
        id: '4',
        text: 'Your verification code is: ABC123. Valid for 10 minutes.',
        sender: '+1234567890',
        timestamp: new Date(now.getTime() - 240000), // 4分钟前
        guid: 'mock-guid-4'
      },
      {
        id: '5',
        text: '普通短信内容，不包含验证码。',
        sender: '+8613800138003',
        timestamp: new Date(now.getTime() - 300000), // 5分钟前
        guid: 'mock-guid-5'
      },
      {
        id: '6',
        text: '【测试】您的验证码是：999888，有效期10分钟。',
        sender: '+8613800138004',
        timestamp: new Date(now.getTime() - 10000), // 10秒前 - 非常新的消息
        guid: 'mock-guid-6'
      }
    ]
    
    console.log('模拟数据已初始化，包含', this.mockMessages.length, '条消息');
  }

  public async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('短信监控已在运行')
      return
    }

    try {
      // 尝试初始化真实数据库连接，如果失败则使用模拟数据
      await this.initializeMonitoring()
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

  private async initializeMonitoring(): Promise<void> {
    const dbPath = join(homedir(), 'Library/Messages/chat.db')
    
    if (existsSync(dbPath)) {
      try {
        console.log('尝试连接Messages数据库...');
        await this.initializeDatabase(dbPath)
        this.useRealDatabase = true
        console.log('✅ 成功连接Messages数据库，将使用真实短信数据');
      } catch (error) {
        console.warn('⚠️  连接数据库失败，使用模拟数据:', error);
        this.useRealDatabase = false
      }
    } else {
      console.log('❌ 未找到Messages数据库，使用模拟数据');
      this.useRealDatabase = false
    }

    // 设置定期检查
    this.setupPeriodicCheck()
  }

  private async initializeDatabase(dbPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.database = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(new Error(`无法连接到 Messages 数据库: ${err}`))
          return
        }
        
        // 测试数据库连接
        this.database!.get('SELECT COUNT(*) as count FROM message LIMIT 1', (err, row: any) => {
          if (err) {
            reject(new Error(`数据库查询测试失败: ${err}`))
            return
          }
          
          console.log('数据库连接测试成功，消息表可访问');
          resolve()
        })
      })
    })
  }

  private setupPeriodicCheck(): void {
    const config = this.configManager.getConfig()
    
    this.checkInterval = setInterval(() => {
      this.checkForNewMessages()
    }, config.monitoring.check_interval)

    console.log('定期检查已设置')
  }

  private async checkForNewMessages(): Promise<void> {
    try {
      const config = this.configManager.getConfig()
      // 首次启动时，检查过去1小时的消息，之后使用lastCheckTime
      let lookbackTime: Date;
      const now = new Date();
      
      // 检查是否是首次检查或距离上次检查超过1小时
      const timeSinceLastCheck = now.getTime() - this.lastCheckTime.getTime();
      console.log(`距离上次检查的时间: ${timeSinceLastCheck}ms, lastCheckTime: ${this.lastCheckTime.toISOString()}`);
      
      if (timeSinceLastCheck > 60 * 60 * 1000) {
        // 如果距离上次检查超过1小时（比如应用刚启动），检查过去1小时
        lookbackTime = new Date(now.getTime() - 60 * 60 * 1000); // 1小时前
        console.log('🚀 应用启动或长时间未检查，查看过去1小时的消息');
      } else {
        // 正常情况下，使用lastCheckTime作为查询起点，额外往前30秒确保不遗漏
        lookbackTime = new Date(this.lastCheckTime.getTime() - 30000); // 额外往前30秒
        console.log('🔄 正常检查，使用lastCheckTime');
      }

      console.log(`正在检查新消息... (自 ${lookbackTime.toLocaleTimeString()} 起)`);
      const messages = await this.queryRecentMessagesAsync(lookbackTime)
      console.log(`检查到 ${messages.length} 条最近消息`);
      
      // 只处理在lastCheckTime之后的消息（除非是首次检查）
      let newMessages: SMSMessage[];
      if (timeSinceLastCheck > 60 * 60 * 1000) {
        // 首次检查或长时间未检查，处理所有找到的消息
        newMessages = messages;
        console.log(`首次检查，处理所有 ${messages.length} 条消息`);
      } else {
        // 正常检查，只处理新消息
        newMessages = messages.filter(message => message.timestamp > this.lastCheckTime);
        console.log(`其中 ${newMessages.length} 条是新消息`);
      }
      
      for (const message of newMessages) {
        console.log(`检查消息: ${message.text.substring(0, 50)}... (${message.timestamp.toLocaleTimeString()})`);
        const verificationCode = extractVerificationCode(message.text, message.sender)
        
        if (verificationCode) {
          console.log('🎉 发现新验证码:', verificationCode)
          
          // 触发验证码提取事件，同时传递原始短信信息
          this.emit('verification-code-extracted', verificationCode, message)
          
          // 只有在正常监控模式下（不是首次启动）才执行自动化操作
          if (timeSinceLastCheck <= 60 * 60 * 1000) {
            console.log('🔄 正常监控模式，执行自动化操作（复制到剪贴板）');
            try {
              await this.automationService.executeAutoSequence(verificationCode.code)
            } catch (error) {
              console.error('自动化操作失败:', error)
            }
          } else {
            console.log('🚀 首次启动模式，不执行自动化操作，仅发送事件');
          }
        }
      }
      
      // 另外，如果有任何消息（不管是否包含验证码），都发送最新的一条到前端
      if (messages.length > 0) {
        const latestMessage = messages[0]; // 数据库查询是按时间降序排列的
        console.log('📩 发送最新短信到前端:', latestMessage.text.substring(0, 30) + '...');
        this.emit('latest-message-updated', latestMessage);
        
        // 检查最新短信是否包含验证码，但只在正常监控模式下更新剪贴板
        const latestVerificationCode = extractVerificationCode(latestMessage.text, latestMessage.sender)
        if (latestVerificationCode && timeSinceLastCheck <= 60 * 60 * 1000) {
          console.log('📩 正常监控模式，最新短信包含验证码，更新剪贴板:', latestVerificationCode.code);
          try {
            await this.automationService.executeAutoSequence(latestVerificationCode.code)
          } catch (error) {
            console.error('更新剪贴板失败:', error)
          }
        } else if (latestVerificationCode) {
          console.log('📩 首次启动模式，最新短信包含验证码，但不更新剪贴板:', latestVerificationCode.code);
        } else {
          console.log('📩 最新短信不包含验证码，不更新剪贴板');
        }
      }

      // 更新最后检查时间
      this.lastCheckTime = new Date()
    } catch (error) {
      console.error('检查新消息失败:', error)
    }
  }

  // 查询最近的消息
private queryRecentMessages(since: Date): SMSMessage[] {
    if (this.useRealDatabase && this.database) {
      try {
        // 由于sqlite3是异步的，这里暂时返回空数组，需要重构为异步方法
        console.log('注意：数据库查询需要重构为异步方法');
        return []
      } catch (error) {
        console.error('查询数据库失败，使用模拟数据:', error)
        return this.mockMessages.filter(message => message.timestamp > since)
      }
    } else {
      // 返回指定时间之后的模拟消息
      return this.mockMessages.filter(message => message.timestamp > since)
    }
  }

  // 异步查询最近的消息
  private async queryRecentMessagesAsync(since: Date): Promise<SMSMessage[]> {
    if (this.useRealDatabase && this.database) {
      try {
        console.log(`正在从真实数据库查询最近消息... (自 ${since.toLocaleTimeString()} 起)`);
        
        // 首先查询所有最近的消息，不限时间，看看数据库里有什么
        const debugQuery = `
          SELECT 
            m.ROWID as id,
            m.text,
            h.id as sender,
            datetime(m.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as timestamp,
            m.guid,
            m.date/1000000000 + strftime('%s', '2001-01-01') as unix_timestamp,
            m.date as original_date
          FROM message m
          JOIN handle h ON m.handle_id = h.ROWID
          WHERE m.text IS NOT NULL 
            AND m.text != ''
          ORDER BY m.date DESC
          LIMIT 10
        `;
        
        console.log('🔍 先查询最新的10条消息，看看数据库状态:');
        const debugPromise = new Promise<any[]>((resolve, reject) => {
          this.database!.all(debugQuery, [], (err, rows: any[]) => {
            if (err) {
              console.error('调试查询失败:', err);
              reject(err);
              return;
            }
            resolve(rows);
          });
        });
        
        const debugRows = await debugPromise;
        console.log(`📊 数据库中最新的 ${debugRows.length} 条消息:`);
        debugRows.forEach((row, index) => {
          const msgTimestamp = new Date(row.unix_timestamp * 1000);
          console.log(`${index + 1}. [${msgTimestamp.toLocaleString()}] ${row.sender}: ${row.text.substring(0, 50)}...`);
        });
        
        // 现在执行正常的时间过滤查询
        const query = `
          SELECT 
            m.ROWID as id,
            m.text,
            h.id as sender,
            datetime(m.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as timestamp,
            m.guid,
            m.date/1000000000 + strftime('%s', '2001-01-01') as unix_timestamp
          FROM message m
          JOIN handle h ON m.handle_id = h.ROWID
          WHERE m.text IS NOT NULL 
            AND m.text != ''
            AND m.date/1000000000 + strftime('%s', '2001-01-01') >= ?
          ORDER BY m.date DESC
          LIMIT 100
        `;

        const sinceUnixTimestamp = Math.floor(since.getTime() / 1000);
        console.log(`查询参数: unix_timestamp >= ${sinceUnixTimestamp} (${since.toISOString()})`);
        
        // 让我们也显示当前时间用于对比
        const now = new Date();
        const nowUnixTimestamp = Math.floor(now.getTime() / 1000);
        console.log(`当前时间: unix_timestamp = ${nowUnixTimestamp} (${now.toISOString()})`);

        return new Promise((resolve, reject) => {
          this.database!.all(query, [sinceUnixTimestamp], (err, rows: any[]) => {
            if (err) {
              console.error('数据库查询失败:', err);
              reject(err);
              return;
            }

            const messages = rows.map((row) => ({
              id: String(row.id),
              text: row.text || '',
              sender: row.sender || 'Unknown',
              timestamp: new Date(row.unix_timestamp * 1000), // 使用unix_timestamp转换
              guid: row.guid || ''
            }));

            console.log(`从数据库查询到 ${messages.length} 条最近消息`);
            if (messages.length > 0) {
              console.log('最新消息时间:', messages[0].timestamp.toLocaleTimeString());
              console.log('最旧消息时间:', messages[messages.length - 1].timestamp.toLocaleTimeString());
            }
            resolve(messages);
          });
        });
      } catch (error) {
        console.error('查询数据库失败，使用模拟数据:', error)
        return this.mockMessages.filter(message => message.timestamp > since)
      }
    } else {
      // 使用模拟数据
      console.log(`使用模拟数据查询最近消息... (自 ${since.toLocaleTimeString()} 起)`);
      const filteredMessages = this.mockMessages.filter(message => message.timestamp > since);
      console.log(`从模拟数据查询到 ${filteredMessages.length} 条最近消息`);
      return filteredMessages;
    }
  }

  // 获取所有消息（用于测试复制功能）
  public getAllMessages(): SMSMessage[] {
    if (this.useRealDatabase && this.database) {
      // 使用Promise来包装异步查询，但这里为了保持同步接口，暂时返回模拟数据
      // 在实际使用中，应该将此方法改为异步方法
      this.queryRealMessages().then(messages => {
        console.log(`从数据库获取到 ${messages.length} 条消息`);
        // 这里可以触发事件通知有新数据
      }).catch(error => {
        console.error('查询真实数据库失败:', error);
      });
      
      // 暂时返回模拟数据作为后备
      return [...this.mockMessages].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    } else {
      return [...this.mockMessages].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    }
  }

  // 异步查询真实数据库消息
  private queryRealMessages(): Promise<SMSMessage[]> {
    return new Promise((resolve, reject) => {
      if (!this.database) {
        reject(new Error('数据库未连接'));
        return;
      }

      const query = `
        SELECT 
          m.ROWID as id,
          m.text,
          h.id as sender,
          datetime(m.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as timestamp,
          m.guid
        FROM message m
        JOIN handle h ON m.handle_id = h.ROWID
        WHERE m.text IS NOT NULL 
          AND m.text != ''
        ORDER BY m.date DESC
        LIMIT 100
      `;

      this.database.all(query, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const messages = rows.map((row) => ({
          id: String(row.id),
          text: row.text || '',
          sender: row.sender || 'Unknown',
          timestamp: new Date(row.timestamp),
          guid: row.guid || ''
        }));

        resolve(messages);
      });
    });
  }

  // 查找第一条包含验证码的消息
  public findFirstVerificationCodeMessage(): { message: SMSMessage; code: VerificationCode } | null {
    if (this.useRealDatabase && this.database) {
      // 对于真实数据库，我们需要异步查询，这里先返回null，实际使用时需要重构为异步
      console.log('注意：真实数据库查询需要异步实现');
      return this.findFirstVerificationCodeFromMockData();
    } else {
      return this.findFirstVerificationCodeFromMockData();
    }
  }

  // 从模拟数据中查找验证码
  private findFirstVerificationCodeFromMockData(): { message: SMSMessage; code: VerificationCode } | null {
    const sortedMessages = [...this.mockMessages].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    for (const message of sortedMessages) {
      const verificationCode = extractVerificationCode(message.text, message.sender)
      if (verificationCode) {
        return { message, code: verificationCode }
      }
    }
    
    return null
  }

  // 从指定索引开始查找下一条包含验证码的消息
  public findNextVerificationCodeMessage(startIndex: number): { message: SMSMessage; code: VerificationCode; index: number } | null {
    const sortedMessages = this.getAllMessages()
    
    for (let i = startIndex; i < sortedMessages.length; i++) {
      const message = sortedMessages[i]
      const verificationCode = extractVerificationCode(message.text, message.sender)
      if (verificationCode) {
        return { message, code: verificationCode, index: i }
      }
    }
    
    return null
  }

  // 异步查找包含验证码的消息（用于真实数据库）
  public async findVerificationCodeFromRealDB(): Promise<{ message: SMSMessage; code: VerificationCode } | null> {
    if (!this.useRealDatabase || !this.database) {
      return this.findFirstVerificationCodeFromMockData();
    }

    try {
      const messages = await this.queryRealMessages();
      
      for (const message of messages) {
        const verificationCode = extractVerificationCode(message.text, message.sender);
        if (verificationCode) {
          console.log(`✅ 从真实数据库找到验证码: ${verificationCode.code}`);
          return { message, code: verificationCode };
        }
      }
      
      console.log('❌ 真实数据库中未找到验证码');
      return null;
      
    } catch (error) {
      console.error('查询真实数据库失败，使用模拟数据:', error);
      return this.findFirstVerificationCodeFromMockData();
    }
  }

  private cleanup(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    
    if (this.database) {
      this.database.close((err) => {
        if (err) {
          console.error('关闭数据库连接失败:', err)
        } else {
          console.log('数据库连接已关闭')
        }
      })
      this.database = null
    }
  }

  public isRunning(): boolean {
    return this.isMonitoring
  }
  
  // 公开方法：获取最新短信
  public async getLatestMessages(limit: number = 10): Promise<SMSMessage[]> {
    return await this.queryRecentMessagesAsync(new Date(0)) // 从1970年开始查询
  }
}