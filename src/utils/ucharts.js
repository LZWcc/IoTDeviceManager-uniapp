export function toChartNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeChartSeries(series, chartType = "line") {
  const resolvedType = chartType === "bar" ? "column" : chartType

  return (series || []).map((item) => ({
    ...item,
    type: resolvedType,
    data: (item.data || []).map((value) => toChartNumber(value)),
    ...(resolvedType === "line" ? { style: "curve" } : {}),
  }))
}

export function createValueAxisConfig(series, { forceZeroMin = false } = {}) {
  const values = (series || [])
    .flatMap((item) => item.data || [])
    .map((value) => toChartNumber(value))
    .filter((value) => value !== null)

  if (!values.length) {
    return {
      disabled: false,
      splitNumber: 5,
    }
  }

  let min = Math.min(...values)
  let max = Math.max(...values)

  if (min === max) {
    const delta = max === 0 ? 10 : Math.abs(max) * 0.2
    min -= delta
    max += delta
  } else {
    const delta = (max - min) * 0.1
    min -= delta
    max += delta
  }

  if (forceZeroMin && min > 0) {
    min = 0
  }

  return {
    disabled: false,
    splitNumber: 5,
    data: [
      {
        min,
        max,
      },
    ],
  }
}

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
