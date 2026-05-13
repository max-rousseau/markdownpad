// Flips Electron fuses on the packaged binary before code-signing.
// Disables the cookie-encryption fuse so first-launch doesn't show the
// macOS Keychain "Safe Storage" prompt — markdownpad has no cookies,
// sessions, or saved credentials, so OSCrypt initialization is gratuitous.
const path = require('node:path')
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')

exports.default = async function afterPack(context) {
  const ext = { darwin: '.app', win32: '.exe', linux: '' }[context.electronPlatformName]
  const electronBinary = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}${ext}`,
  )

  await flipFuses(electronBinary, {
    version: FuseVersion.V1,
    [FuseV1Options.EnableCookieEncryption]: false,
  })
}
