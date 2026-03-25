const DEFAULT_API_BASE_URL = "http://127.0.0.1:8081"

function trimTrailingSlash(url) {
  return url.replace(/\/+$/, "")
}

function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (envUrl) {
    return trimTrailingSlash(envUrl)
  }

  return DEFAULT_API_BASE_URL
}

function getWsBaseUrl() {
  const envUrl = import.meta.env.VITE_WS_BASE_URL
  if (envUrl) {
    return trimTrailingSlash(envUrl)
  }

  const apiBaseUrl = getApiBaseUrl()
  if (apiBaseUrl.startsWith("https://")) {
    return `wss://${apiBaseUrl.slice("https://".length)}`
  }

  if (apiBaseUrl.startsWith("http://")) {
    return `ws://${apiBaseUrl.slice("http://".length)}`
  }

  return "ws://127.0.0.1:8081"
}

export const API_BASE_URL = getApiBaseUrl()
export const WS_BASE_URL = getWsBaseUrl()
