import { EventEmitter } from 'events'
import Store from 'electron-store'
import type { AppConfig, AppSettings } from '@shared/types'
import { DEFAULT_CONFIG } from '@shared/constants'
import { safeJsonParse } from '@shared/utils'

export class ConfigManager extends EventEmitter {
  private store: Store<AppConfig>
  private config: AppConfig

  constructor() {
    super()
    
    // 初始化 electron-store
    this.store = new Store<AppConfig>({
      name: 'messauto-config',
      defaults: DEFAULT_CONFIG,
      schema: {
        version: { type: 'string' },
        settings: {
          type: 'object',
          properties: {
            hide_icon_forever: { type: 'boolean' },
            launch_at_login: { type: 'boolean' },
            language: { type: 'string', enum: ['auto', 'zh-CN', 'en'] },
          },
          required: ['hide_icon_forever', 'launch_at_login', 'language'],
        },
        monitoring: {
          type: 'object',
          properties: {
            check_interval: { type: 'number', minimum: 100 },
            message_lookback_minutes: { type: 'number', minimum: 1 },
          },
          required: ['check_interval', 'message_lookback_minutes'],
        },
      },
    })

    // 加载初始配置
    this.config = this.loadConfig()
  }

  public async initialize(): Promise<void> {
    try {
      // 验证配置完整性
      this.validateConfig()
      
      // 监听配置文件变化
      this.store.onDidAnyChange((newValue, oldValue) => {
        if (newValue) {
          this.config = newValue
          this.emit('config-changed', this.config)
        }
      })

      console.log('配置管理器初始化成功:', this.config)
    } catch (error) {
      console.error('配置管理器初始化失败:', error)
      throw error
    }
  }

  private loadConfig(): AppConfig {
    try {
      // 从 store 加载配置
      const storedConfig = this.store.store
      
      // 合并默认配置和存储的配置
      const config: AppConfig = {
        version: storedConfig.version || DEFAULT_CONFIG.version,
        settings: {
          ...DEFAULT_CONFIG.settings,
          ...storedConfig.settings,
        },
        monitoring: {
          ...DEFAULT_CONFIG.monitoring,
          ...storedConfig.monitoring,
        },
      }

      return config
    } catch (error) {
      console.error('加载配置失败，使用默认配置:', error)
      return { ...DEFAULT_CONFIG }
    }
  }

  private validateConfig(): void {
    if (!this.config) {
      throw new Error('配置为空')
    }

    // 验证必需的属性
    if (!this.config.version) {
      this.config.version = DEFAULT_CONFIG.version
    }

    if (!this.config.settings) {
      this.config.settings = { ...DEFAULT_CONFIG.settings }
    }

    if (!this.config.monitoring) {
      this.config.monitoring = { ...DEFAULT_CONFIG.monitoring }
    }

    // 验证设置值的有效性
    if (typeof this.config.settings.hide_icon_forever !== 'boolean') {
      this.config.settings.hide_icon_forever = DEFAULT_CONFIG.settings.hide_icon_forever
    }

    if (typeof this.config.settings.launch_at_login !== 'boolean') {
      this.config.settings.launch_at_login = DEFAULT_CONFIG.settings.launch_at_login
    }

    const validLanguages = ['auto', 'zh-CN', 'en']
    if (!validLanguages.includes(this.config.settings.language)) {
      this.config.settings.language = DEFAULT_CONFIG.settings.language
    }

    // 验证监控配置
    if (typeof this.config.monitoring.check_interval !== 'number' || 
        this.config.monitoring.check_interval < 100) {
      this.config.monitoring.check_interval = DEFAULT_CONFIG.monitoring.check_interval
    }

    if (typeof this.config.monitoring.message_lookback_minutes !== 'number' || 
        this.config.monitoring.message_lookback_minutes < 1) {
      this.config.monitoring.message_lookback_minutes = DEFAULT_CONFIG.monitoring.message_lookback_minutes
    }

  }

  public getConfig(): AppConfig {
    return { ...this.config }
  }

  public getSettings(): AppSettings {
    return { ...this.config.settings }
  }

  public async updateSettings(newSettings: Partial<AppSettings>): Promise<void> {
    try {
      // 创建新的设置对象
      const updatedSettings: AppSettings = {
        ...this.config.settings,
        ...newSettings,
      }

      // 更新配置
      const updatedConfig: AppConfig = {
        ...this.config,
        settings: updatedSettings,
      }

      // 保存到 store
      this.store.set('settings', updatedSettings)
      
      // 更新内存中的配置
      this.config = updatedConfig

      // 触发配置变更事件
      this.emit('config-changed', this.config)

      console.log('设置已更新:', updatedSettings)
    } catch (error) {
      console.error('更新设置失败:', error)
      throw error
    }
  }

  public async updateMonitoringConfig(newConfig: Partial<typeof DEFAULT_CONFIG.monitoring>): Promise<void> {
    try {
      const updatedMonitoring = {
        ...this.config.monitoring,
        ...newConfig,
      }

      // 验证值的有效性
      if (updatedMonitoring.check_interval < 100) {
        updatedMonitoring.check_interval = 100
      }

      if (updatedMonitoring.message_lookback_minutes < 1) {
        updatedMonitoring.message_lookback_minutes = 1
      }

      const updatedConfig: AppConfig = {
        ...this.config,
        monitoring: updatedMonitoring,
      }

      // 保存到 store
      this.store.set('monitoring', updatedMonitoring)
      
      // 更新内存中的配置
      this.config = updatedConfig

      // 触发配置变更事件
      this.emit('config-changed', this.config)

      console.log('监控配置已更新:', updatedMonitoring)
    } catch (error) {
      console.error('更新监控配置失败:', error)
      throw error
    }
  }

  public async resetToDefaults(): Promise<void> {
    try {
      // 重置为默认配置
      const defaultConfig = { ...DEFAULT_CONFIG }
      
      // 清除所有存储的配置
      this.store.clear()
      
      // 设置默认配置
      this.store.store = defaultConfig
      
      // 更新内存中的配置
      this.config = defaultConfig

      // 触发配置变更事件
      this.emit('config-changed', this.config)

      console.log('配置已重置为默认值')
    } catch (error) {
      console.error('重置配置失败:', error)
      throw error
    }
  }

  public exportConfig(): string {
    return JSON.stringify(this.config, null, 2)
  }

  public async importConfig(configJson: string): Promise<void> {
    try {
      const importedConfig = safeJsonParse<AppConfig>(configJson, DEFAULT_CONFIG)
      
      // 验证导入的配置
      this.config = importedConfig
      this.validateConfig()
      
      // 保存到 store
      this.store.store = this.config

      // 触发配置变更事件
      this.emit('config-changed', this.config)

      console.log('配置导入成功')
    } catch (error) {
      console.error('导入配置失败:', error)
      throw error
    }
  }

  public getConfigPath(): string {
    return this.store.path
  }
}