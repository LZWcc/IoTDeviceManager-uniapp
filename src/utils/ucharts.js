/**
 * 将后端或表格里的字段值统一转成 uCharts 可绘制的数值。
 * 空值、undefined、空字符串和非数字统一返回 null，让折线出现断点而不是渲染崩溃。
 */
export function toChartNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 规整图表 series，屏蔽页面之间的数据格式差异。
 * uCharts 的柱状图类型名是 column，所以这里把业务侧的 bar 转成 column；
 * 同时补齐单 Y 轴 index，避免 uCharts 的多轴分组逻辑找不到对应数据。
 */
export function normalizeChartSeries(series, chartType = "line") {
  const resolvedType = chartType === "bar" ? "column" : chartType

  return (series || []).map((item) => ({
    ...item,
    index: item.index ?? 0,
    type: resolvedType,
    data: (item.data || []).map((value) => toChartNumber(value)),
    ...(resolvedType === "line" ? { style: "curve" } : {}),
  }))
}

/**
 * 根据当前 series 生成 uCharts 的 Y 轴配置。
 * 默认会给数据范围留一点上下边距；当指标是 0-100 这种固定范围时，
 * 可以传 fixedMax: 100 强制上界，避免 uCharts 自动把 100 扩成 107。
 */
export function createValueAxisConfig(
  series,
  { forceZeroMin = false, fixedMax = null } = {},
) {
  const numericFixedMax = Number(fixedMax)
  const hasFixedMax = Number.isFinite(numericFixedMax)
  const values = (series || [])
    .flatMap((item) => item.data || [])
    .map((value) => toChartNumber(value))
    .filter((value) => value !== null)

  if (!values.length) {
    // 空数据时仍保留调用方声明的固定上下界，页面可以显示稳定坐标轴或空态。
    if (forceZeroMin || hasFixedMax) {
      return {
        disabled: false,
        splitNumber: 5,
        data: [
          createAxisRange({
            min: forceZeroMin ? 0 : undefined,
            max: hasFixedMax ? numericFixedMax : undefined,
          }),
        ],
      }
    }

    return {
      disabled: false,
      splitNumber: 5,
    }
  }

  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  let min = rawMin
  let max = rawMax

  // 非固定范围时保留轻微留白，让普通曲线不贴边显示。
  if (min === max) {
    const delta = max === 0 ? 10 : Math.abs(max) * 0.2
    min -= delta
    max += delta
  } else {
    const delta = (max - min) * 0.1
    min -= delta
    max += delta
  }

  // 对全为非负数的指标，强制从 0 开始，避免 0 附近的数据被扩成负刻度。
  if (forceZeroMin && rawMin >= 0) {
    min = 0
  }

  // 固定上界优先级最高，主要用于 0-100 范围的设备指标。
  if (hasFixedMax) {
    max = numericFixedMax
  }

  return {
    disabled: false,
    splitNumber: 5,
    data: [
      createAxisRange({
        min,
        max,
      }),
    ],
  }
}

/**
 * 创建 uCharts 单 Y 轴配置项。
 * 这里显式补齐 disabled、position 和 formatter，避免 uCharts 在多轴分支里
 * 因字段缺失或默认 formatter 不一致导致刻度异常。
 */
function createAxisRange({ min, max }) {
  return {
    disabled: false,
    position: "left",
    ...(Number.isFinite(min) ? { min } : {}),
    ...(Number.isFinite(max) ? { max } : {}),
    formatter: (value) => {
      const numeric = Number(value)
      return Number.isFinite(numeric) ? String(Math.round(numeric)) : String(value)
    },
  }
}

/**
 * 对齐旧版 /api/format-chart 返回的 times 和 series。
 * 当前后端可能返回“已抽样的 times + 未抽样的 series.data”，这里按旧逻辑
 * 从完整 series 中取出与 times 数量一致的数据点，避免 X 轴和 Y 轴错位。
 */
export function alignChartDataToCategories(times = [], series = []) {
  if (!Array.isArray(times) || !Array.isArray(series) || !times.length) {
    return { times: [], series: [] }
  }

  const maxDataLength = Math.max(
    0,
    ...series.map((item) => (Array.isArray(item?.data) ? item.data.length : 0)),
  )

  if (maxDataLength <= times.length) {
    return { times, series }
  }

  const indexes = buildLegacyChartIndexes(maxDataLength, times.length)
  const alignedSeries = series.map((item) => {
    const data = Array.isArray(item?.data) ? item.data : []
    if (data.length <= times.length) {
      return item
    }

    return {
      ...item,
      data: indexes.map((index) => data[index] ?? null),
    }
  })

  return {
    times,
    series: alignedSeries,
  }
}

/**
 * 复刻旧图表接口的抽样索引规则。
 * 优先保持原有行为，只有旧规则无法生成目标数量时，才退回到均匀取点。
 */
function buildLegacyChartIndexes(sourceLength, targetLength) {
  if (targetLength <= 0) return []
  if (sourceLength <= targetLength) {
    return Array.from({ length: targetLength }, (_, index) => index)
  }

  const legacyStep =
    sourceLength > 15
      ? Math.ceil(sourceLength / 15)
      : Math.ceil(sourceLength / targetLength)
  const legacyIndexes = []
  for (
    let index = 0;
    index < sourceLength && legacyIndexes.length < targetLength;
    index += legacyStep
  ) {
    legacyIndexes.push(index)
  }

  if (legacyIndexes.length === targetLength) {
    return legacyIndexes
  }

  if (targetLength === 1) return [0]
  return Array.from({ length: targetLength }, (_, index) =>
    Math.round((index * (sourceLength - 1)) / (targetLength - 1)),
  )
}

/**
 * 前端降采样，限制 uCharts 一次绘制的数据点数量。
 * 采样时保留最后一个点，确保最新 MQTT/查询结果能出现在趋势总览尾部。
 */
export function downsampleChartData(times = [], series = [], maxPoints = 120) {
  if (!Array.isArray(times) || !Array.isArray(series)) {
    return { times: [], series: [] }
  }

  const total = times.length
  if (total <= maxPoints || maxPoints < 2) {
    return { times, series }
  }

  const indexes = []
  const step = Math.ceil((total - 1) / (maxPoints - 1))
  for (let i = 0; i < total; i += step) {
    indexes.push(i)
  }
  if (indexes[indexes.length - 1] !== total - 1) {
    indexes.push(total - 1)
  }

  const sampledTimes = indexes.map((index) => times[index])
  const sampledSeries = series.map((item) => ({
    ...item,
    data: indexes.map((index) => (item?.data || [])[index]),
  }))

  return {
    times: sampledTimes,
    series: sampledSeries,
  }
}
