import { app, dialog, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import { SMSMonitor } from './monitor'
import { AutomationService } from './automation'

class MainApplication {
  private tray: Tray | null = null
  private smsMonitor: SMSMonitor | null = null
  private automationService: AutomationService | null = null

  constructor() {
    this.initializeApp()
  }

  private async initializeApp(): Promise<void> {
    console.log('🚀 正在初始化应用...')

    // 确保只有一个应用实例运行
    const gotTheLock = app.requestSingleInstanceLock()

    if (!gotTheLock) {
      console.log('⚠️ 应用已在运行，退出当前实例')
      app.quit()
      return
    }

    console.log('✅ 获得应用锁')

    // 设置应用事件监听
    this.setupAppEventListeners()

    // 应用准备就绪时初始化
    app.whenReady().then(() => {
      console.log('✅ Electron 应用已准备就绪')
      this.onAppReady()
    })
  }

  private setupAppEventListeners(): void {
    app.on('window-all-closed', () => {
      // 系统托盘应用不退出
    })

    app.on('before-quit', () => {
      this.cleanup()
    })

    electronApp.setAppUserModelId('com.otpmaster.electron')
  }

  private async onAppReady(): Promise<void> {
    try {
      console.log('🚀 OTPMaster 正在启动...')

      // 隐藏Dock图标，纯后台运行
      if (app.dock) {
        app.dock.hide()
        console.log('📱 已隐藏Dock图标')
      }

      // 初始化核心服务
      console.log('⚙️ 正在初始化服务...')
      await this.initializeServices()

      // 创建系统托盘
      console.log('🎛️ 正在创建系统托盘...')
      this.createTray()

      console.log('✅ OTPMaster 已启动')
      console.log('🔧 调试模式：可通过终端查看日志')
      console.log('📱 右键点击系统托盘图标查看菜单')
    } catch (error) {
      console.error('❌ 启动失败:', error)
      setTimeout(() => {
        app.quit()
      }, 1000)
    }
  }

  private async initializeServices(): Promise<void> {
    try {
      console.log('🔧 正在初始化自动化服务...')
      // 初始化自动化服务
      this.automationService = new AutomationService()
      console.log('✅ 自动化服务初始化完成')

      console.log('📱 正在初始化短信监控器...')
      // 初始化短信监控器
      this.smsMonitor = new SMSMonitor(this.automationService)
      console.log('✅ 短信监控器初始化完成')

      console.log('🚀 正在启动监控...')
      // 启动监控
      await this.smsMonitor.startMonitoring()
      console.log('✅ 监控启动完成')
    } catch (error) {
      console.error('❌ 服务初始化失败:', error)
      throw error
    }
  }

  private createTray(): void {
    try {
      // 创建托盘图标
      const iconPath = is.dev
        ? join(__dirname, '../../assets/icons/tray-icon.png')
        : join(process.resourcesPath, 'assets/icons/tray-icon.png')

      console.log('🖼️ 正在加载托盘图标:', iconPath)

      const image = nativeImage.createFromPath(iconPath)
      if (image.isEmpty()) {
        console.warn('⚠️ 托盘图标加载失败，使用默认图标')
        this.tray = new Tray(nativeImage.createEmpty())
      } else {
        this.tray = new Tray(image.resize({ width: 16, height: 16 }))
        console.log('✅ 托盘图标加载成功')
      }

      // 设置托盘菜单
      const contextMenu = Menu.buildFromTemplate([
        {
          label: '关于 OTPMaster',
          click: () => this.showAbout()
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => this.quit()
        }
      ])

      this.tray.setContextMenu(contextMenu)
      this.tray.setToolTip('OTPMaster - OTP一次性密码自动管理')
      console.log('✅ 系统托盘创建成功')
    } catch (error) {
      console.error('❌ 创建系统托盘失败:', error)
      throw error
    }
  }

  private showAbout(): void {
    dialog.showMessageBox({
      type: 'info',
      title: '关于 OTPMaster',
      message: 'OTPMaster v1.0.0',
      detail: 'OTP一次性密码自动管理工具\n运行状态：正常监控中',
      buttons: ['确定']
    })
  }

  private quit(): void {
    app.quit()
  }

  private cleanup(): void {
    if (this.smsMonitor) {
      this.smsMonitor.stopMonitoring()
    }
    if (this.tray) {
      this.tray.destroy()
    }
  }
}

// 创建应用实例
new MainApplication()
