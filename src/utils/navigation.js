const TAB_BAR_PAGES = new Set([
  "/pages/config/DirectConfig",
  "/pages/device/DeviceManage",
  "/pages/sensor/RealtimeData",
  "/pages/behavior/RealtimeData",
])

export function navigateToPage(url) {
  if (TAB_BAR_PAGES.has(url)) {
    uni.switchTab({ url })
    return
  }

  uni.navigateTo({ url })
}
