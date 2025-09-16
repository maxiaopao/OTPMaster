import { EventEmitter } from 'events'
import { shell } from 'electron'
import { existsSync, accessSync, constants } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { PermissionStatus, PermissionCheckResult } from '@shared/types'
import { PERMISSIONS, PATHS } from '@shared/constants'
import { isMacOS } from '@shared/utils'

export class PermissionManager extends EventEmitter {
  private currentStatus: PermissionStatus = {
    fullDiskAccess: false,
    accessibility: false,
  }

  private checkInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.startPeriodicCheck()
  }

  public async checkAllPermissions(): Promise<PermissionStatus> {
    const fullDiskAccess = await this.checkFullDiskAccess()
    const accessibility = await this.checkAccessibilityPermission()

    const newStatus: PermissionStatus = {
      fullDiskAccess: fullDiskAccess.hasPermission,
      accessibility: accessibility.hasPermission,
    }

    if (this.hasStatusChanged(newStatus)) {
      this.currentStatus = newStatus
      this.emit('permission-changed', this.currentStatus)
    }

    return this.currentStatus
  }

  private async checkFullDiskAccess(): Promise<PermissionCheckResult> {
    if (!isMacOS()) {
      return { hasPermission: true }
    }

    try {
      const messagesDbPath = join(homedir(), 'Library/Messages/chat.db')
      
      if (!existsSync(messagesDbPath)) {
        return { 
          hasPermission: false, 
          errorMessage: 'Messages 数据库文件不存在' 
        }
      }

      accessSync(messagesDbPath, constants.R_OK)
      return { hasPermission: true }
    } catch (error) {
      return { 
        hasPermission: false, 
        errorMessage: `无法访问 Messages 数据库: ${error}` 
      }
    }
  }

  private async checkAccessibilityPermission(): Promise<PermissionCheckResult> {
    if (!isMacOS()) {
      return { hasPermission: true }
    }

    try {
      // 在 macOS 上检查辅助功能权限
      // 注意：在实际使用中，需要使用如 robotjs 或 @nut-tree/nut-js 等自动化库来检查
      // 这里仅作为演示，实际部署时需要正确的权限检查实现
      console.log('模拟辅助功能权限检查')
      
      // 临时返回 true，实际使用时需要正确的权限检查
      return { hasPermission: true }
    } catch (error) {
      return { 
        hasPermission: false, 
        errorMessage: `辅助功能权限检查失败: ${error}` 
      }
    }
  }

  public openSystemPreferences(type: 'disk-access' | 'accessibility'): void {
    const urls = {
      'disk-access': PERMISSIONS.SYSTEM_PREFERENCES_PATHS.FULL_DISK_ACCESS,
      'accessibility': PERMISSIONS.SYSTEM_PREFERENCES_PATHS.ACCESSIBILITY,
    }

    shell.openExternal(urls[type])
  }

  private hasStatusChanged(newStatus: PermissionStatus): boolean {
    return (
      this.currentStatus.fullDiskAccess !== newStatus.fullDiskAccess ||
      this.currentStatus.accessibility !== newStatus.accessibility
    )
  }

  private startPeriodicCheck(): void {
    this.checkInterval = setInterval(() => {
      this.checkAllPermissions()
    }, PERMISSIONS.CHECK_INTERVAL)
  }

  public stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  public getCurrentStatus(): PermissionStatus {
    return { ...this.currentStatus }
  }
}