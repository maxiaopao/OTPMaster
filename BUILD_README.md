# Build and Package Configuration

## Development Build
npm run dev

## Production Build
npm run build

## Package for Distribution
npm run build:mac

## Build Configuration

### Electron Builder
The project uses electron-builder for packaging. Configuration is in package.json:

- **appId**: com.messauto.electron
- **productName**: MessAuto
- **Output directory**: dist/
- **Build files**: dist-electron/, dist/

### macOS Specific
- **Target**: DMG installer for x64 and arm64
- **Icon**: build/icons/icon.icns
- **Entitlements**: build/entitlements.plist
- **Code signing**: Configured for hardened runtime
- **Gatekeeper**: Disabled for development

### Security
- **Hardened Runtime**: Enabled
- **Code Signing**: Required for distribution
- **Notarization**: Required for macOS distribution

## Development vs Production

### Development
- Hot reload enabled
- Source maps included
- Debug mode active
- Development server on localhost

### Production
- Code minification
- Tree shaking
- Optimized bundles
- No source maps

## Build Artifacts

After successful build:
- `dist-electron/`: Compiled Electron main and preload scripts
- `dist/`: Compiled renderer (Vue) application
- `dist/`: Final packaged application (after electron-builder)

## Troubleshooting

### Common Issues
1. **Icon not found**: Ensure icon files exist in build/icons/
2. **Permission errors**: Check entitlements.plist configuration
3. **Code signing**: Ensure proper certificates are installed
4. **Native dependencies**: Some may need rebuilding for Electron

### Platform Specific
- **macOS**: Requires Xcode command line tools
- **Windows**: Requires Visual Studio Build Tools
- **Linux**: Requires build-essential package