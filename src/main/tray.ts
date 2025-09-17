import { Tray, Menu, nativeImage } from 'electron'
import { existsSync } from 'fs'
import type { AppSettings, TrayMenuState } from '@shared/types'
import { TRAY_MENU_IDS } from '@shared/constants'
import type { ConfigManager } from './config'

export class TrayManager {
  private tray: Tray | null = null
  private isVisible = true

  constructor(
    private iconPath: string,
    private configManager: ConfigManager,
    private onMenuClick: (menuId: string) => void
  ) {
    this.createTray()
  }

  private createTray(): void {
    try {
      // 检查图标文件是否存在
      if (!existsSync(this.iconPath)) {
        console.warn('托盘图标文件不存在:', this.iconPath)
        // 创建一个简单的默认图标
        const icon = nativeImage.createEmpty()
        icon.resize({ width: 16, height: 16 })
        this.tray = new Tray(icon)
      } else {
        // 创建托盘图标
        const icon = nativeImage.createFromPath(this.iconPath)
        
        // 确保图标大小适合托盘
        icon.setTemplateImage(true)
        
        this.tray = new Tray(icon)
        console.log('托盘图标加载成功:', this.iconPath)
      }
      
      this.tray.setToolTip('MessAuto - 短信验证码自动提取')
      
      // 构建菜单
      this.updateMenu(this.configManager.getConfig().settings)
      
      // 监听点击事件
      this.tray.on('click', () => {
        // macOS 上点击托盘图标时的行为
        this.onMenuClick('settings')
      })
      
      console.log('系统托盘创建成功')
    } catch (error) {
      console.error('创建系统托盘失败:', error)
      // 即使图标加载失败，也尝试创建一个基本的托盘
      try {
        const fallbackIcon = nativeImage.createEmpty()
        fallbackIcon.resize({ width: 16, height: 16 })
        this.tray = new Tray(fallbackIcon)
        this.tray.setToolTip('MessAuto - 短信验证码自动提取')
        this.updateMenu(this.configManager.getConfig().settings)
        console.log('使用备用方案创建了系统托盘')
      } catch (fallbackError) {
        console.error('备用托盘创建也失败:', fallbackError)
      }
    }
  }

  public updateMenu(settings: AppSettings): void {
    if (!this.tray) return

    try {
      const template = this.buildMenuTemplate(settings)
      const menu = Menu.buildFromTemplate(template)
      this.tray.setContextMenu(menu)
    } catch (error) {
      console.error('更新托盘菜单失败:', error)
    }
  }

  private buildMenuTemplate(settings: AppSettings): Electron.MenuItemConstructorOptions[] {
    return [
      {
        label: '📨 MessAuto',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: '📁 隐藏图标',
        submenu: [
          {
            id: TRAY_MENU_IDS.HIDE_ICON_TEMP,
            label: '暂时隐藏',
            type: 'normal',
            click: () => this.onMenuClick(TRAY_MENU_IDS.HIDE_ICON_TEMP),
          },
          {
            id: TRAY_MENU_IDS.HIDE_ICON_FOREVER,
            label: '永久隐藏',
            type: 'normal',
            click: () => this.onMenuClick(TRAY_MENU_IDS.HIDE_ICON_FOREVER),
          },
        ],
      },
      { type: 'separator' },
      {
        id: TRAY_MENU_IDS.LAUNCH_AT_LOGIN,
        label: `${settings.launch_at_login ? '✅' : '❌'} 登录时启动`,
        type: 'normal',
        click: () => this.onMenuClick(TRAY_MENU_IDS.LAUNCH_AT_LOGIN),
      },
      { type: 'separator' },
      {
        id: TRAY_MENU_IDS.SETTINGS,
        label: '⚙️ 设置',
        type: 'normal',
        click: () => this.onMenuClick(TRAY_MENU_IDS.SETTINGS),
      },
      {
        id: TRAY_MENU_IDS.ABOUT,
        label: 'ℹ️ 关于',
        type: 'normal',
        click: () => this.onMenuClick(TRAY_MENU_IDS.ABOUT),
      },
      { type: 'separator' },
      {
        id: TRAY_MENU_IDS.QUIT,
        label: '❌ 退出',
        type: 'normal',
        click: () => this.onMenuClick(TRAY_MENU_IDS.QUIT),
      },
    ]
  }

  public show(): void {
    if (this.tray && !this.isVisible) {
      this.tray.setImage(this.iconPath)
      this.isVisible = true
      console.log('托盘图标已显示')
    }
  }

  public hide(): void {
    if (this.tray && this.isVisible) {
      // 在 macOS 上，我们不能真正隐藏托盘图标，但可以使其不可见
      const emptyImage = nativeImage.createEmpty()
      this.tray.setImage(emptyImage)
      this.isVisible = false
      console.log('托盘图标已隐藏')
    }
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
      this.isVisible = false
      console.log('托盘图标已销毁')
    }
  }

  public setTooltip(tooltip: string): void {
    if (this.tray) {
      this.tray.setToolTip(tooltip)
    }
  }

  public isDestroyed(): boolean {
    return !this.tray || this.tray.isDestroyed()
  }
}