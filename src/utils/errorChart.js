export const ERROR_CHART_COLORS = [
  "#2563eb",
  "#dc2626",
  "#d97706",
  "#059669",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
]

// 按指定字段统计错误数量。空字段统一归为“未填写”，避免图表出现空白标签。
export function countRowsByKey(rows, key) {
  const counts = new Map()
  rows.forEach((row) => {
    const rawValue = row?.[key]
    const label = String(rawValue ?? "").trim() || "未填写"
    counts.set(label, (counts.get(label) || 0) + 1)
  })
  return counts
}

// 分页聚合时每页都会产生一个 Map，这里把它们合并到总计数里。
export function mergeCounts(target, source) {
  source.forEach((count, label) => {
    target.set(label, (target.get(label) || 0) + count)
  })
  return target
}

// uCharts ring 图只展示 Top N，长标签截断但保留 rawName 方便后续 tooltip 或调试使用。
export function toErrorRingSeries(counts, options = {}) {
  const {
    colors = ERROR_CHART_COLORS,
    limit = 8,
    maxNameLength = 14,
  } = options

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value], index) => ({
      name: name.length > maxNameLength ? `${name.slice(0, maxNameLength)}...` : name,
      rawName: name,
      data: value,
      color: colors[index % colors.length],
    }))
    .filter((item) => item.data > 0)
}
