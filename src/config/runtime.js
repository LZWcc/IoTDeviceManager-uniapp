// 前端接口地址与 WebSocket 地址的唯一运行时来源。
// 优先级: uni.setStorageSync 覆盖 > .env(VITE_*) > 内置默认。
// 地址可在「设备管理页 -> 设置」里修改, 改后需重启 App 才生效
// (API_BASE_URL / WS_BASE_URL 在模块加载时即求值)。

const LS_API_KEY = "cfg_api_base_url"
const LS_WS_KEY = "cfg_ws_base_url"
const DEFAULT_API_BASE_URL = "http://127.0.0.1:8081"

function trimTrailingSlash(url) {
  return url.replace(/\/+$/, "")
}

function readOverride(key) {
  try {
    const v = uni.getStorageSync(key)
    return v ? trimTrailingSlash(v) : ""
  } catch (e) {
    return ""
  }
}

function deriveWsFromApi(apiBaseUrl) {
  if (apiBaseUrl.startsWith("https://")) {
    return `wss://${apiBaseUrl.slice("https://".length)}`
  }
  if (apiBaseUrl.startsWith("http://")) {
    return `ws://${apiBaseUrl.slice("http://".length)}`
  }
  return "ws://127.0.0.1:8081"
}

function getApiBaseUrl() {
  const override = readOverride(LS_API_KEY)
  if (override) {
    return override
  }

  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (envUrl) {
    return trimTrailingSlash(envUrl)
  }

  return DEFAULT_API_BASE_URL
}

function getWsBaseUrl() {
  const override = readOverride(LS_WS_KEY)
  if (override) {
    return override
  }

  const envUrl = import.meta.env.VITE_WS_BASE_URL
  if (envUrl) {
    return trimTrailingSlash(envUrl)
  }

  return deriveWsFromApi(getApiBaseUrl())
}

export const API_BASE_URL = getApiBaseUrl()
export const WS_BASE_URL = getWsBaseUrl()

// 当前 storage 覆盖值(设置页回显; 没有覆盖时为空字符串)
export function getServerConfigOverride() {
  return {
    apiBaseUrl: readOverride(LS_API_KEY),
    wsBaseUrl: readOverride(LS_WS_KEY),
  }
}

// 当前实际生效地址(覆盖/env/默认 解析后的结果)
export function getEffectiveServerConfig() {
  return {
    apiBaseUrl: getApiBaseUrl(),
    wsBaseUrl: getWsBaseUrl(),
  }
}

// 保存覆盖地址; 只传 apiBaseUrl 时 ws 按 http/https 自动推导。
export function setServerConfigOverride({ apiBaseUrl, wsBaseUrl } = {}) {
  if (apiBaseUrl !== undefined) {
    const v = trimTrailingSlash(String(apiBaseUrl).trim())
    if (v) {
      uni.setStorageSync(LS_API_KEY, v)
      if (wsBaseUrl === undefined) {
        uni.setStorageSync(LS_WS_KEY, deriveWsFromApi(v))
      }
    } else {
      uni.removeStorageSync(LS_API_KEY)
      if (wsBaseUrl === undefined) {
        uni.removeStorageSync(LS_WS_KEY)
      }
    }
  }
  if (wsBaseUrl !== undefined) {
    const v = trimTrailingSlash(String(wsBaseUrl).trim())
    if (v) {
      uni.setStorageSync(LS_WS_KEY, v)
    } else {
      uni.removeStorageSync(LS_WS_KEY)
    }
  }
}

// 清除覆盖, 回到 .env / 默认值。
export function resetServerConfigOverride() {
  uni.removeStorageSync(LS_API_KEY)
  uni.removeStorageSync(LS_WS_KEY)
}
