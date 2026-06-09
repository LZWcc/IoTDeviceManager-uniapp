import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue"
import { getFormatChart, getFormatPaged } from "@/api/get_format_limit"
import { appStore } from "@/stores/index"
import {
  alignChartDataToCategories,
  createValueAxisConfig,
  downsampleChartData,
  normalizeChartSeries,
  toChartNumber,
} from "@/utils/ucharts"
import wsClient from "@/utils/websocket"
import { navigateToPage } from "@/utils/navigation"

const pageSizes = [5, 10, 20, 50, 100]
const onlineOptions = [
  { label: "全部", value: "" },
  { label: "实时数据", value: "实时数据" },
  { label: "保存数据", value: "保存数据" },
]
const chartModeOptions = [
  { label: "趋势总览", value: "range" },
  { label: "当前页明细", value: "page" },
]
const chartTypes = [
  { label: "折线图", value: "line" },
  { label: "柱状图", value: "bar" },
]
const CHART_REFRESH_INTERVAL = 10000
const HISTORY_REFRESH_DEBOUNCE = 400
const MAX_CHART_POINTS_MOBILE = 120
const MAX_CHART_POINTS_DESKTOP = 200
const CHART_AXIS_MAX = null
const PAGE_CHART_EXCLUDED_FIELDS = new Set([
  "设备编号",
  "是否在线数据",
  "更新时间",
])

export function useHistoryChartView({ type }) {
  const d_no = ref("")
  const startDateTime = ref("")
  const endDateTime = ref("")
  const onlineFilter = ref("")
  const tableData = ref([])
  const tableHeader = ref([])
  const total = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(10)
  const pageSizeIndex = ref(1)
  const chartDataMode = ref("page")
  const chartTypeIndex = ref(0)
  const chartCategories = shallowRef([])
  const chartSeries = shallowRef([])
  const chartYAxis = shallowRef({ disabled: false, splitNumber: 5 })
  let wsRefreshTimer = null
  let wsHistoryRefreshTimer = null
  let chartRequestId = 0
  let lastChartFetchAt = 0
  let isChartFetching = false
  let hasPendingChartRefresh = false
  const wsTopic = `${type}_update`

  const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)
  const chartModeIndex = computed(() => {
    const index = chartModeOptions.findIndex(
      (item) => item.value === chartDataMode.value,
    )
    return index >= 0 ? index : 0
  })
  const currentChartType = computed(() => chartTypes[chartTypeIndex.value].value)

  const formattedTableData = computed(() => {
    return tableData.value.map((row) => {
      const formattedRow = {}
      row.forEach((field) => {
        formattedRow[field.f_name] =
          field.value === null || field.value === undefined ? "" : field.value
      })
      return formattedRow
    })
  })

  const filteredTableHeader = computed(() => {
    if (appStore.value.settings.showDeviceFeatures) {
      return tableHeader.value
    }
    return tableHeader.value.filter((col) => col.prop !== "设备编号")
  })

  const handleWsData = (data) => {
    // 历史页收到实时推送后不直接改表格，只在推送数据命中当前筛选范围时调度刷新。
    if (shouldRefreshChartFromWs(data)) {
      scheduleHistoryRefresh()
    }
  }

  // 页面初始化入口：先加载当前页表格；默认 page 模式下会顺带用表格数据生成图表，最后再订阅实时更新。
  onMounted(async () => {
    try {
      await fetchData()
      if (chartDataMode.value === "range") {
        await fetchChartData()
      }
    } catch (error) {
      console.error("初始化失败:", error)
      uni.showToast({
        title: "初始化失败",
        icon: "none",
      })
    }

    // 初始化数据完成后再监听 WebSocket，避免页面还未准备好就处理实时推送。
    wsClient.on(wsTopic, handleWsData)
    wsClient.send({
      type: "subscribe",
      topics: [wsTopic],
    })
  })

  onUnmounted(() => {
    wsClient.off(wsTopic, handleWsData)
    clearScheduledChartRefresh()
    clearScheduledHistoryRefresh()
  })

  // 统一整理分页接口返回值：表格行、动态表头和总数都在这里标准化。
  function normalizeTableResponse(res) {
    const rows = Array.isArray(res.data) ? res.data : []
    const headers = rows.length
      ? rows[0].map((field) => ({
          prop: field.f_name,
          label: field.unit ? `${field.f_name}(${field.unit})` : field.f_name,
        }))
      : []

    return {
      rows,
      headers,
      total: res.total,
    }
  }

  // 应用表格请求结果；当前页明细模式下，图表直接跟随表格当前页同步重建。
  function applyTableResponse(result) {
    tableData.value = result.rows
    tableHeader.value = result.headers
    total.value = result.total

    if (chartDataMode.value === "page") {
      updateChartFromCurrentPage()
    }
  }

  // 表格数据主入口：只请求当前页数据，并把响应交给标准化和应用函数处理。
  // 表格接口只负责当前页数据；图表接口单独请求，避免把两种返回结构混在一起处理。
  async function fetchData() {
    try {
      const res = await getFormatPaged(
        currentPage.value,
        pageSize.value,
        d_no.value,
        startDateTime.value,
        endDateTime.value,
        type,
        onlineFilter.value,
      )
      applyTableResponse(normalizeTableResponse(res))
    } catch (error) {
      console.error("获取数据失败:", error)
      uni.showToast({ title: "获取数据失败", icon: "none" })
    }
  }

  function getChartMaxPoints() {
    const screenWidth = uni.getSystemInfoSync().windowWidth || 375
    return screenWidth >= 1024
      ? MAX_CHART_POINTS_DESKTOP
      : MAX_CHART_POINTS_MOBILE
  }

  function normalizeChartResponse(res) {
    const { times, series } = res.data || {}
    if (!times?.length) {
      return {
        categories: [],
        series: [],
        yAxis: { disabled: false, splitNumber: 5 },
      }
    }

    const aligned = alignChartDataToCategories(times, series)
    const sampled = downsampleChartData(
      aligned.times,
      aligned.series,
      getChartMaxPoints(),
    )
    const normalizedSeries = normalizeChartSeries(
      sampled.series.map((item) => ({
        ...item,
        unit: item.unit || "",
      })),
      currentChartType.value,
    )

    return {
      categories: sampled.times,
      series: normalizedSeries,
      yAxis: createValueAxisConfig(normalizedSeries, {
        forceZeroMin: true,
        fixedMax: CHART_AXIS_MAX,
      }),
    }
  }

  function applyChartResponse(result, requestId) {
    // 图表请求可能被筛选、模式切换打断，旧请求回来不能覆盖新状态。
    if (requestId !== chartRequestId || chartDataMode.value !== "range") return

    chartCategories.value = result.categories
    chartSeries.value = result.series
    chartYAxis.value = result.yAxis
    appendLatestTablePointToRangeChart()
  }

  // 趋势总览使用独立图表接口；当前页明细模式由表格数据生成，不走这里。
  async function fetchChartData() {
    if (chartDataMode.value !== "range") return
    if (isChartFetching) {
      hasPendingChartRefresh = true
      return
    }

    isChartFetching = true
    const requestId = ++chartRequestId
    lastChartFetchAt = Date.now()
    try {
      const res = await getFormatChart(
        d_no.value,
        startDateTime.value,
        endDateTime.value,
        type,
        onlineFilter.value,
      )
      applyChartResponse(normalizeChartResponse(res), requestId)
    } catch (error) {
      console.error("获取图表数据失败:", error)
      uni.showToast({
        title: "获取图表数据失败",
        icon: "none",
      })
    } finally {
      isChartFetching = false
      if (hasPendingChartRefresh) {
        hasPendingChartRefresh = false
        scheduleChartRefresh()
      }
    }
  }

  function clearScheduledChartRefresh() {
    if (wsRefreshTimer) {
      clearTimeout(wsRefreshTimer)
      wsRefreshTimer = null
    }
    hasPendingChartRefresh = false
  }

  function clearScheduledHistoryRefresh() {
    if (wsHistoryRefreshTimer) {
      clearTimeout(wsHistoryRefreshTimer)
      wsHistoryRefreshTimer = null
    }
  }

  function shouldRefreshChartFromWs(data) {
    // 设备功能开启且用户已筛选设备时，只响应同设备推送；未筛选设备时保留“全设备”刷新行为。
    if (
      appStore.value.settings.showDeviceFeatures &&
      d_no.value &&
      data.d_no &&
      data.d_no !== d_no.value
    ) {
      return false
    }
    // 没有时间戳就无法判断是否命中当前时间筛选，直接忽略，避免无效刷新。
    if (!data.timestamp) return false

    // 只在推送时间落入当前筛选区间时刷新；起止时间为空表示该方向不限制。
    const dataTime = new Date(data.timestamp)
    if (Number.isNaN(dataTime.getTime())) return false

    const start = parseDateTimeValue(startDateTime.value)
    const end = parseDateTimeValue(endDateTime.value)
    return (!start || dataTime >= start) && (!end || dataTime <= end)
  }

  function scheduleChartRefresh() {
    if (chartDataMode.value !== "range") return

    const elapsed = Date.now() - lastChartFetchAt
    const delay = Math.max(500, CHART_REFRESH_INTERVAL - elapsed)
    clearScheduledChartRefresh()

    // 图表接口可能较重，实时推送过来时至少间隔 CHART_REFRESH_INTERVAL 再重新拉取。
    wsRefreshTimer = setTimeout(() => {
      if (isChartFetching) {
        hasPendingChartRefresh = true
        return
      }
      fetchChartData()
    }, delay)
  }

  function scheduleHistoryRefresh() {
    clearScheduledHistoryRefresh()

    wsHistoryRefreshTimer = setTimeout(async () => {
      wsHistoryRefreshTimer = null
      await fetchData()
      if (chartDataMode.value === "range") {
        // WebSocket 是被动高频来源，趋势图刷新必须复用节流，不能绕过后直接拉全量图表。
        scheduleChartRefresh()
      }
    }, HISTORY_REFRESH_DEBOUNCE)
  }

  function onDeviceInput(e) {
    d_no.value = e.detail.value ?? e.target.value ?? ""
  }

  function onStartDateTimeChange(value) {
    startDateTime.value = String(value || "").trim()
  }

  function onEndDateTimeChange(value) {
    endDateTime.value = String(value || "").trim()
  }

  function parseDateTimeValue(value) {
    const text = String(value || "").trim()
    if (!text) return null

    const [dateText = "", timeText = ""] = text.replace("T", " ").split(" ")
    const dateParts = dateText.split("-").map((item) => Number(item))
    const timeParts = timeText.split(":").map((item) => Number(item))
    if (dateParts.length !== 3 || timeParts.length !== 3) return null

    const [year, month, day] = dateParts
    const [hour, minute, second] = timeParts
    if (
      [year, month, day, hour, minute, second].some(
        (item) => !Number.isFinite(item),
      )
    ) {
      return null
    }

    return new Date(year, month - 1, day, hour, minute, second)
  }

  const onlinePickerIndex = computed(() => {
    const idx = onlineOptions.findIndex((o) => o.value === onlineFilter.value)
    return idx >= 0 ? idx : 0
  })

  function onOnlineFilterChange(e) {
    onlineFilter.value = onlineOptions[e.detail.value].value
  }

  async function onFilter() {
    if (!appStore.value.settings.showDeviceFeatures) {
      d_no.value = ""
    }
    currentPage.value = 1
    await fetchData()
    if (chartDataMode.value === "range") {
      clearScheduledChartRefresh()
      await fetchChartData()
    }
  }

  async function onReset() {
    d_no.value = ""
    startDateTime.value = ""
    endDateTime.value = ""
    onlineFilter.value = ""
    currentPage.value = 1
    await fetchData()
    if (chartDataMode.value === "range") {
      clearScheduledChartRefresh()
      await fetchChartData()
    }
  }

  function onPageSizeChange(e) {
    pageSizeIndex.value = e.detail.value
    pageSize.value = pageSizes[e.detail.value]
    currentPage.value = 1
    fetchData()
  }

  function onChartTypeChange(e) {
    const index = Number(e.detail.value ?? e.target.value ?? 0)
    chartTypeIndex.value = Number.isNaN(index) ? 0 : index
    chartSeries.value = normalizeChartSeries(
      (chartSeries.value || []).map((item) => ({
        ...item,
      })),
      currentChartType.value,
    )
  }

  function onChartModeChange(e) {
    const index = Number(e.detail.value ?? e.target.value ?? 0)
    const nextMode = chartModeOptions[index]?.value || "range"
    chartDataMode.value = nextMode

    if (nextMode === "page") {
      updateChartFromCurrentPage()
      return
    }

    clearScheduledChartRefresh()
    lastChartFetchAt = 0
    fetchChartData()
  }

  // 当前页明细图表入口：不请求图表接口，直接把当前页表格数据转换成图表数据。
  function updateChartFromCurrentPage() {
    clearScheduledChartRefresh()
    chartRequestId += 1

    const { categories, series } = buildChartDataFromTableData(tableData.value)
    const normalizedSeries = normalizeChartSeries(series, currentChartType.value)

    chartCategories.value = categories
    chartSeries.value = normalizedSeries
    chartYAxis.value = createValueAxisConfig(normalizedSeries, {
      forceZeroMin: true,
      fixedMax: CHART_AXIS_MAX,
    })
  }

  // 将当前页表格行转换为图表 categories/series；表格通常倒序展示，图表按时间正序展示。
  function buildChartDataFromTableData(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { categories: [], series: [] }
    }

    const orderedRows = [...rows].reverse()
    const categories = orderedRows.map((row, index) => {
      const timeField = findFieldByName(row, "更新时间")
      const value = timeField?.value
      return value === null || value === undefined || value === ""
        ? String(index + 1)
        : String(value)
    })
    const metricNames = []
    const metricUnits = new Map()

    orderedRows.forEach((row) => {
      if (!Array.isArray(row)) return
      row.forEach((field) => {
        if (!field?.f_name || PAGE_CHART_EXCLUDED_FIELDS.has(field.f_name)) return
        if (metricNames.includes(field.f_name)) return
        if (toChartNumber(field.value) === null) return

        metricNames.push(field.f_name)
        metricUnits.set(field.f_name, field.unit || "")
      })
    })

    const series = metricNames.map((name) => ({
      name,
      unit: metricUnits.get(name) || "",
      data: orderedRows.map((row) => {
        const field = findFieldByName(row, name)
        return toChartNumber(field?.value)
      }),
    }))

    return { categories, series }
  }

  function findFieldByName(row, name) {
    if (!Array.isArray(row)) return null
    return row.find((field) => field?.f_name === name) || null
  }

  function appendLatestTablePointToRangeChart() {
    const latestRow = tableData.value[0]
    if (!Array.isArray(latestRow) || chartDataMode.value !== "range") return
    if (!chartCategories.value?.length || !chartSeries.value?.length) return

    const timeText = getChartMinuteText(
      findFieldByName(latestRow, "更新时间")?.value,
    )
    if (!timeText || chartCategories.value.includes(timeText)) return

    const nextSeries = chartSeries.value.map((item) => {
      if (!item?.name || !Array.isArray(item.data)) return item

      const field = findFieldByName(latestRow, item.name)
      return {
        ...item,
        data: [...item.data, toChartNumber(field?.value)],
      }
    })

    chartCategories.value = [...chartCategories.value, timeText]
    chartSeries.value = nextSeries
    chartYAxis.value = createValueAxisConfig(nextSeries, {
      forceZeroMin: true,
      fixedMax: CHART_AXIS_MAX,
    })
  }

  function getChartMinuteText(value) {
    if (!value) return ""
    const text = String(value).replace("T", " ")
    const match = text.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/)
    return match ? match[1] : text
  }

  function prevPage() {
    if (currentPage.value > 1) {
      currentPage.value--
      fetchData()
    }
  }

  function nextPage() {
    if (currentPage.value < totalPages.value) {
      currentPage.value++
      fetchData()
    }
  }

  return {
    appStore,
    chartCategories,
    chartModeIndex,
    chartModeOptions,
    chartSeries,
    chartTypeIndex,
    chartTypes,
    chartYAxis,
    currentChartType,
    currentPage,
    d_no,
    endDateTime,
    filteredTableHeader,
    formattedTableData,
    navigateToPage,
    nextPage,
    onChartModeChange,
    onChartTypeChange,
    onDeviceInput,
    onEndDateTimeChange,
    onFilter,
    onlineFilter,
    onlineOptions,
    onlinePickerIndex,
    onOnlineFilterChange,
    onPageSizeChange,
    onReset,
    onStartDateTimeChange,
    pageSize,
    pageSizeIndex,
    pageSizes,
    prevPage,
    startDateTime,
    total,
    totalPages,
  }
}
