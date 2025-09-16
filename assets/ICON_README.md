# MessAuto 图标说明

## 图标文件说明

由于这是一个代码初始化项目，以下图标文件需要手动添加：

### 应用程序图标
- `assets/icons/icon.png` - 主应用图标 (512x512)
- `assets/icons/icon@2x.png` - 高分辨率应用图标 (1024x1024)
- `assets/icons/tray-icon.png` - 系统托盘图标 (16x16, 32x32)

### 构建图标
- `build/icons/icon.icns` - macOS 应用图标
- `build/icons/icon.ico` - Windows 应用图标
- `build/icons/icon.png` - Linux 应用图标

## 图标要求

### 系统托盘图标
- 尺寸: 16x16 (标准), 32x32 (高分辨率)
- 格式: PNG
- 样式: 单色，适合托盘显示
- 建议: 使用简单的短信或邮件图标

### 应用程序图标
- 尺寸: 512x512, 1024x1024
- 格式: PNG, ICNS (macOS), ICO (Windows)
- 样式: 彩色，符合 macOS 设计规范
- 建议: 结合短信和自动化元素的设计

## 临时占位图标

在开发阶段，可以使用以下命令生成简单的占位图标：

```bash
# 创建简单的占位图标
echo "MessAuto" > assets/icons/placeholder.txt
```

## 图标制作工具推荐

- **macOS**: Sketch, Figma, Icon Set Creator
- **在线工具**: Canva, IconBuddy, Logomaker
- **免费工具**: GIMP, Inkscape

## 注意事项

1. 托盘图标应该在明暗两种主题下都清晰可见
2. 应用图标应遵循目标平台的设计指南
3. 所有图标应提供多种分辨率版本
4. 确保图标版权清晰，避免使用受版权保护的素材