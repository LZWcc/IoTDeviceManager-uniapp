// 将接口、输入框和 WebSocket 中可能出现的时间文本统一转为时间戳。
// 返回 null 表示没有边界或无法解析，调用方可按“不限制”处理。
export function parseDateTimeTimestamp(value) {
  if (!value) return null
  const normalized = String(value).trim().replace("T", " ")
  const timestamp = new Date(normalized.replace(/-/g, "/")).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

// start/end 为空或无法解析时代表不限制；value 无法解析时不主动过滤，避免误丢实时推送。
export function isWithinDateTimeRange(value, start, end) {
  const currentTs = parseDateTimeTimestamp(value)
  const startTs = parseDateTimeTimestamp(start)
  const endTs = parseDateTimeTimestamp(end)

  if (currentTs === null) return true
  if (startTs !== null && currentTs < startTs) return false
  if (endTs !== null && currentTs > endTs) return false
  return true
}
