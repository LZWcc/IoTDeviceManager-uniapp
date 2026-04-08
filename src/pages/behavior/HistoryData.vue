<template>
  <view class="page">
    <view class="menu-list">
      <view
        class="menu-item"
        @click="navigateTo('/pages/behavior/RealtimeData')"
      >
        <text class="menu-icon">📊</text>
        <text class="menu-text">实时数据</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item current">
        <text class="menu-icon">📈</text>
        <text class="menu-text">历史数据</text>
        <text class="menu-badge">当前页</text>
      </view>
    </view>

    <view
      class="filter-wrapper"
      data-debug-scope="history-filter"
      @click="onFilterWrapperClick"
    >
      <view
        class="filter-item"
        v-if="appStore.settings.showDeviceFeatures"
        @click="onFieldContainerClick('device-field', $event)"
      >
        <text class="filter-label">设备编号</text>
        <input
          class="filter-input"
          :value="d_no"
          data-debug-id="device-field"
          placeholder="请输入设备编号"
          confirm-type="done"
          @click="onFieldMouseConfirm('device-field', $event)"
          @focus="onFieldFocus('device-field', $event)"
          @blur="onFieldBlur('device-field', $event)"
          @input="onDeviceInput"
          @confirm="onFilter"
        />
      </view>

      <view class="filter-item">
        <text class="filter-label">开始时间</text>
        <DateTimePickerField
          field="start"
          debug-id="start-datetime-field"
          placeholder="请选择开始时间"
          default-start-time="00:00:00"
          default-end-time="23:59:59"
          :start-value="startDateTimeText"
          :end-value="endDateTimeText"
          @update:startValue="onStartDateTimeChange"
          @update:endValue="onEndDateTimeChange"
        />
      </view>

      <view class="filter-item">
        <text class="filter-label">结束时间</text>
        <DateTimePickerField
          field="end"
          debug-id="end-datetime-field"
          placeholder="请选择结束时间"
          default-start-time="00:00:00"
          default-end-time="23:59:59"
          :start-value="startDateTimeText"
          :end-value="endDateTimeText"
          @update:startValue="onStartDateTimeChange"
          @update:endValue="onEndDateTimeChange"
        />
      </view>

      <view class="filter-actions">
        <button class="query-btn" @click="onFilter">查询</button>
        <button class="reset-btn" @click="onReset">重置</button>
      </view>

    </view>

    <view class="table-wrapper">
      <view class="table-container">
        <!-- #ifdef H5 -->
        <view class="table-scroll table-scroll-native">
          <view class="table-scroll-content">
            <view class="table">
              <view class="table-header">
                <view
                  class="table-cell header-cell"
                  v-for="(header, index) in filteredTableHeader"
                  :key="index"
                >
                  <text>{{ header.label }}</text>
                </view>
              </view>

              <view class="table-body">
                <view
                  class="table-row"
                  v-for="(row, rowIndex) in formattedTableData"
                  :key="rowIndex"
                >
                  <view
                    class="table-cell"
                    v-for="(header, colIndex) in filteredTableHeader"
                    :key="colIndex"
                  >
                    <text>{{ row[header.prop] || "-" }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <scroll-view scroll-x="true" class="table-scroll">
          <view class="table-scroll-content">
            <view class="table">
              <view class="table-header">
                <view
                  class="table-cell header-cell"
                  v-for="(header, index) in filteredTableHeader"
                  :key="index"
                >
                  <text>{{ header.label }}</text>
                </view>
              </view>

              <view class="table-body">
                <view
                  class="table-row"
                  v-for="(row, rowIndex) in formattedTableData"
                  :key="rowIndex"
                >
                  <view
                    class="table-cell"
                    v-for="(header, colIndex) in filteredTableHeader"
                    :key="colIndex"
                  >
                    <text>{{ row[header.prop] || "-" }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
        <!-- #endif -->

        <view class="empty-data" v-if="formattedTableData.length === 0">
          <text>暂无数据</text>
        </view>
      </view>
    </view>

    <view class="pagination-wrapper">
      <view class="pagination-controls">
        <text class="total-text">共 {{ total }} 条</text>
        <view class="pagination-center">
          <button
            class="page-btn"
            :disabled="currentPage === 1"
            @click="prevPage"
          >
            ‹
          </button>
          <text class="page-info">{{ currentPage }} / {{ totalPages }}</text>
          <button
            class="page-btn"
            :disabled="currentPage >= totalPages"
            @click="nextPage"
          >
            ›
          </button>
          <picker
            mode="selector"
            :range="pageSizes"
            :value="pageSizeIndex"
            @change="onPageSizeChange"
          >
            <view class="page-size-picker">
              <text>{{ pageSize }}条/页 ▼</text>
            </view>
          </picker>
        </view>
      </view>
    </view>

    <view class="chart-wrapper">
      <view class="chart-toolbar">
        <picker
          mode="selector"
          :range="chartTypes"
          range-key="label"
          :value="chartTypeIndex"
          @change="onChartTypeChange"
        >
          <view class="chart-type-picker">
            <text>{{ chartTypes[chartTypeIndex].label }}</text>
            <text class="chart-type-arrow">▼</text>
          </view>
        </picker>
      </view>
      <UChartCanvas
        :type="currentChartType"
        :categories="chartCategories"
        :series="chartSeries"
        :yAxis="chartYAxis"
        height="640rpx"
      />
    </view>
  </view>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef } from "vue"
import DateTimePickerField from "@/components/DateTimePickerField.vue"
import UChartCanvas from "@/components/charts/UChartCanvas.vue"
import { getFormatChart, getFormatPaged } from "@/api/get_format_limit"
import { appStore } from "@/stores/index"
import {
  createValueAxisConfig,
  downsampleChartData,
  normalizeChartSeries,
} from "@/utils/ucharts"
import wsClient from "@/utils/websocket"
import { navigateToPage } from "@/utils/navigation"

const type = ref("behavior")
const d_no = ref("")
const DEFAULT_START_TIME = "00:00:00"
const DEFAULT_END_TIME = "23:59:59"
const startDate = ref("")
const startTime = ref(DEFAULT_START_TIME)
const endDate = ref("")
const endTime = ref(DEFAULT_END_TIME)
const tableData = ref([])
const tableHeader = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const pageSizes = [5, 10, 20, 50, 100]
const pageSizeIndex = ref(1)
const chartTypeIndex = ref(0)
const chartTypes = [
  { label: "折线图", value: "line" },
  { label: "柱状图", value: "bar" },
]
const chartCategories = shallowRef([])
const chartSeries = shallowRef([])
const chartYAxis = shallowRef({ disabled: false, splitNumber: 5 })
let wsRefreshTimer = null
let chartRequestId = 0
let lastChartFetchAt = 0
let isChartFetching = false
let hasPendingChartRefresh = false
const CHART_REFRESH_INTERVAL = 10000
const MAX_CHART_POINTS_MOBILE = 120
const MAX_CHART_POINTS_DESKTOP = 200
const DEBUG_TAG = "[HistoryDataDebug:behavior]"
const H5_DEBUG_FIELD_IDS = ["device-field"]
const H5_PICKER_FIELD_IDS = new Set()

const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)
const currentChartType = computed(() => chartTypes[chartTypeIndex.value].value)
const startDateTimeText = computed(() =>
  buildDateTimeText(startDate.value, startTime.value, false),
)
const endDateTimeText = computed(() =>
  buildDateTimeText(endDate.value, endTime.value, true),
)

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
  if (
    appStore.value.settings.showDeviceFeatures &&
    data.d_no &&
    data.d_no !== d_no.value
  ) {
    return
  }

  if (!data.timestamp) return

  const dataTime = new Date(data.timestamp)
  const start = parseDateTime(startDate.value, startTime.value, false)
  const end = parseDateTime(endDate.value, endTime.value, true)

  if ((!start || dataTime >= start) && (!end || dataTime <= end)) {
    scheduleChartRefresh()
  }
}

onMounted(async () => {
  try {
    await fetchData()
    await fetchChartData()
  } catch (error) {
    console.error("初始化失败:", error)
    uni.showToast({
      title: "初始化失败",
      icon: "none",
    })
  }

  wsClient.on("behavior_update", handleWsData)
  wsClient.send({
    type: "subscribe",
    topics: ["behavior_update"],
  })

  debugLog("mounted", {
    showDeviceFeatures: appStore.value.settings.showDeviceFeatures,
  })

  // #ifdef H5
  document.addEventListener("click", handleDebugDocumentClick, true)
  logInitialDomState()
  // #endif
})

onUnmounted(() => {
  wsClient.off("behavior_update", handleWsData)
  if (wsRefreshTimer) {
    clearTimeout(wsRefreshTimer)
    wsRefreshTimer = null
  }

  // #ifdef H5
  document.removeEventListener("click", handleDebugDocumentClick, true)
  // #endif
})

async function fetchData() {
  try {
    debugLog("fetchData:start", {
      d_no: d_no.value,
      startDate: startDate.value,
      startTime: startTime.value,
      endDate: endDate.value,
      endTime: endTime.value,
      page: currentPage.value,
      pageSize: pageSize.value,
    })
    const res = await getFormatPaged(
      currentPage.value,
      pageSize.value,
      d_no.value,
      buildDateTimeParam(startDate.value, startTime.value, false),
      buildDateTimeParam(endDate.value, endTime.value, true),
      type.value,
    )
    const response = res.data.data
    total.value = res.data.total

    if (response.length > 0) {
      tableHeader.value = response[0].map((field) => ({
        prop: field.f_name,
        label: field.unit ? `${field.f_name}(${field.unit})` : field.f_name,
      }))
    } else {
      tableHeader.value = []
    }

    tableData.value = response
    debugLog("fetchData:done", {
      total: total.value,
      rows: response.length,
    })
  } catch (error) {
    console.error("获取数据失败:", error)
    uni.showToast({
      title: "获取数据失败",
      icon: "none",
    })
  }
}

async function fetchChartData() {
  if (isChartFetching) {
    hasPendingChartRefresh = true
    return
  }

  isChartFetching = true
  const requestId = ++chartRequestId
  lastChartFetchAt = Date.now()
  try {
    debugLog("fetchChartData:start", {
      d_no: d_no.value,
      startDate: startDate.value,
      startTime: startTime.value,
      endDate: endDate.value,
      endTime: endTime.value,
      chartType: currentChartType.value,
    })
    const res = await getFormatChart(
      d_no.value,
      buildDateTimeParam(startDate.value, startTime.value, false),
      buildDateTimeParam(endDate.value, endTime.value, true),
      type.value,
    )
    const { times, series } = res.data.data

    if (requestId !== chartRequestId) {
      return
    }

    if (!times?.length) {
      chartCategories.value = []
      chartSeries.value = []
      chartYAxis.value = { disabled: false, splitNumber: 5 }
      return
    }

    const screenWidth = uni.getSystemInfoSync().windowWidth || 375
    const maxPoints =
      screenWidth >= 1024 ? MAX_CHART_POINTS_DESKTOP : MAX_CHART_POINTS_MOBILE
    const sampled = downsampleChartData(times, series, maxPoints)
    const normalizedSeries = normalizeChartSeries(
      sampled.series.map((item) => ({
        ...item,
        unit: item.unit || "",
      })),
      currentChartType.value,
    )

    chartCategories.value = sampled.times
    chartSeries.value = normalizedSeries
    chartYAxis.value = createValueAxisConfig(normalizedSeries, {
      forceZeroMin: true,
    })
    debugLog("fetchChartData:done", {
      points: sampled.times.length,
      series: normalizedSeries.length,
    })
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

function scheduleChartRefresh() {
  const elapsed = Date.now() - lastChartFetchAt
  const delay = Math.max(500, CHART_REFRESH_INTERVAL - elapsed)

  if (wsRefreshTimer) {
    clearTimeout(wsRefreshTimer)
  }

  wsRefreshTimer = setTimeout(() => {
    if (isChartFetching) {
      hasPendingChartRefresh = true
      return
    }
    fetchChartData()
  }, delay)
}

function readEventValue(e) {
  if (e?.detail?.value !== undefined) return e.detail.value
  if (e?.target?.value !== undefined) return e.target.value
  return ""
}

function debugLog(action, payload) {
  console.log(DEBUG_TAG, action, payload || "")
}

function describeDomNode(node) {
  if (!node) return "null"

  const tagName = (node.tagName || node.nodeName || "unknown").toLowerCase()
  const id = node.id ? `#${node.id}` : ""
  const className =
    node.classList && node.classList.length > 0
      ? `.${Array.from(node.classList).join(".")}`
      : ""
  const typeAttr =
    typeof node.getAttribute === "function" && node.getAttribute("type")
      ? `[type=${node.getAttribute("type")}]`
      : ""
  const debugId =
    typeof node.getAttribute === "function" && node.getAttribute("data-debug-id")
      ? `[data-debug-id=${node.getAttribute("data-debug-id")}]`
      : ""

  return `${tagName}${id}${className}${typeAttr}${debugId}`
}

function getDomRect(node) {
  if (!node?.getBoundingClientRect) return null
  const rect = node.getBoundingClientRect()
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }
}

function getDomStyle(node) {
  if (!node || typeof window === "undefined") return null
  const style = window.getComputedStyle(node)
  return {
    display: style.display,
    visibility: style.visibility,
    pointerEvents: style.pointerEvents,
    position: style.position,
    zIndex: style.zIndex,
    opacity: style.opacity,
  }
}

function summarizeEvent(e) {
  const payload = {
    type: e?.type || "",
    target: describeDomNode(e?.target),
    currentTarget: describeDomNode(e?.currentTarget),
  }

  if (typeof document !== "undefined") {
    payload.activeElement = describeDomNode(document.activeElement)
  }

  if (typeof e?.clientX === "number") {
    payload.clientX = Math.round(e.clientX)
  }
  if (typeof e?.clientY === "number") {
    payload.clientY = Math.round(e.clientY)
  }

  return payload
}

function getH5Host(fieldId) {
  if (typeof document === "undefined") return null
  return document.querySelector(`[data-debug-id="${fieldId}"]`)
}

function getH5NativeInput(fieldId) {
  const host = getH5Host(fieldId)
  if (!host) return null

  if (host.matches?.("input, textarea, select")) {
    return host
  }

  return host.querySelector("input, textarea, select")
}

function logFieldDomState(fieldId, label = fieldId) {
  if (typeof document === "undefined") return

  const host = getH5Host(fieldId)
  const nativeInput = getH5NativeInput(fieldId)
  const hostRect = host?.getBoundingClientRect?.()
  const centerX = hostRect ? hostRect.left + hostRect.width / 2 : null
  const centerY = hostRect ? hostRect.top + hostRect.height / 2 : null
  const stack =
    centerX !== null && centerY !== null && document.elementsFromPoint
      ? document
          .elementsFromPoint(centerX, centerY)
          .slice(0, 6)
          .map((node) => describeDomNode(node))
      : []

  debugLog(`dom-state:${label}`, {
    host: describeDomNode(host),
    nativeInput: describeDomNode(nativeInput),
    hostRect: getDomRect(host),
    nativeRect: getDomRect(nativeInput),
    hostStyle: getDomStyle(host),
    nativeStyle: getDomStyle(nativeInput),
    stack,
    activeElement:
      typeof document !== "undefined"
        ? describeDomNode(document.activeElement)
        : "null",
  })
}

function focusH5Field(fieldId) {
  if (typeof document === "undefined") return

  const nativeInput = getH5NativeInput(fieldId)
  debugLog(`focus-attempt:${fieldId}`, {
    nativeInput: describeDomNode(nativeInput),
  })

  if (!nativeInput) {
    logFieldDomState(fieldId, `${fieldId}-missing-native`)
    return
  }

  nativeInput.removeAttribute?.("readonly")
  nativeInput.removeAttribute?.("disabled")
  nativeInput.style.pointerEvents = "auto"
  nativeInput.style.userSelect = "text"
  nativeInput.style.webkitUserSelect = "text"

  nativeInput.focus?.()
  nativeInput.select?.()

  if (
    H5_PICKER_FIELD_IDS.has(fieldId) &&
    typeof nativeInput.showPicker === "function"
  ) {
    try {
      nativeInput.showPicker()
      debugLog(`showPicker:${fieldId}`, {
        nativeInput: describeDomNode(nativeInput),
      })
    } catch (error) {
      console.warn(DEBUG_TAG, `showPicker failed for ${fieldId}`, error)
    }
  }

  setTimeout(() => {
    logFieldDomState(fieldId, `${fieldId}-after-focus`)
  }, 0)
}

async function logInitialDomState() {
  if (typeof document === "undefined") return

  await nextTick()
  H5_DEBUG_FIELD_IDS.forEach((fieldId, index) => {
    setTimeout(() => {
      logFieldDomState(fieldId, `mounted-${fieldId}`)
    }, 200 + index * 120)
  })
}

function handleDebugDocumentClick(e) {
  if (typeof Element === "undefined" || !(e.target instanceof Element)) return

  const inFilterScope = e.target.closest('[data-debug-scope="history-filter"]')
  if (!inFilterScope) return

  const path =
    typeof e.composedPath === "function"
      ? e.composedPath()
          .slice(0, 6)
          .map((node) => describeDomNode(node))
      : []

  debugLog("document-capture-click", {
    ...summarizeEvent(e),
    path,
  })
}

function onFilterWrapperClick(e) {
  debugLog("filter-wrapper-click", summarizeEvent(e))
}

function onFieldContainerClick(fieldId, e) {
  debugLog(`container-click:${fieldId}`, summarizeEvent(e))
  focusH5Field(fieldId)
}

function onFieldMouseConfirm(fieldId, e) {
  debugLog(`mouse-confirm:${fieldId}`, summarizeEvent(e))
  focusH5Field(fieldId)
}

function onFieldFocus(fieldId, e) {
  debugLog(`focus:${fieldId}`, summarizeEvent(e))
}

function onFieldBlur(fieldId, e) {
  debugLog(`blur:${fieldId}`, summarizeEvent(e))
}

function onFieldInput(fieldId, e) {
  debugLog(`input:${fieldId}`, {
    ...summarizeEvent(e),
    value: readEventValue(e),
  })
}

function onDeviceInput(e) {
  d_no.value = readEventValue(e)
  debugLog("input:device-field", {
    ...summarizeEvent(e),
    value: d_no.value,
  })
}

function onStartDateTimeChange(value) {
  applyDateTimeValue("start", value)
  debugLog("change:start-datetime-panel", {
    value,
    startDate: startDate.value,
    startTime: startTime.value,
  })
}

function onEndDateTimeChange(value) {
  applyDateTimeValue("end", value)
  debugLog("change:end-datetime-panel", {
    value,
    endDate: endDate.value,
    endTime: endTime.value,
  })
}

function buildDateTimeParam(date, time, isEnd) {
  if (!date) return ""
  const fallbackTime = isEnd ? DEFAULT_END_TIME : DEFAULT_START_TIME
  return `${date} ${normalizeTimeText(time, fallbackTime)}`
}

function buildDateTimeText(date, time, isEnd) {
  if (!date) return ""
  const fallbackTime = isEnd ? DEFAULT_END_TIME : DEFAULT_START_TIME
  return `${date} ${normalizeTimeText(time, fallbackTime)}`
}

function normalizeTimeText(time, fallbackTime) {
  const [fallbackHour = "00", fallbackMinute = "00", fallbackSecond = "00"] =
    String(fallbackTime || DEFAULT_START_TIME).split(":")
  const [hourText = fallbackHour, minuteText = fallbackMinute, secondText = fallbackSecond] =
    String(time || "").split(":")

  const parts = [hourText, minuteText, secondText].map((item, index) => {
    const fallback = [fallbackHour, fallbackMinute, fallbackSecond][index]
    const numeric = Number(item)
    if (Number.isNaN(numeric)) {
      return String(fallback).padStart(2, "0")
    }
    const [min, max] = index === 0 ? [0, 23] : [0, 59]
    const safeValue = Math.min(Math.max(numeric, min), max)
    return String(safeValue).padStart(2, "0")
  })

  return parts.join(":")
}

function applyDateTimeValue(kind, rawValue) {
  const normalizedValue = String(rawValue || "").trim()
  const isEnd = kind === "end"

  if (!normalizedValue) {
    if (kind === "start") {
      startDate.value = ""
      startTime.value = DEFAULT_START_TIME
    } else {
      endDate.value = ""
      endTime.value = DEFAULT_END_TIME
    }
    return
  }

  const [dateText, timeText = isEnd ? DEFAULT_END_TIME : DEFAULT_START_TIME] =
    normalizedValue.replace(" ", "T").split("T")
  const safeTime = normalizeTimeText(
    timeText,
    isEnd ? DEFAULT_END_TIME : DEFAULT_START_TIME,
  )

  if (kind === "start") {
    startDate.value = dateText
    startTime.value = safeTime || DEFAULT_START_TIME
  } else {
    endDate.value = dateText
    endTime.value = safeTime || DEFAULT_END_TIME
  }
}

function parseDateTime(date, time, isEnd) {
  if (!date) return null
  const [year, month, day] = date.split("-").map((item) => Number(item))
  const [hour, minute, second] = normalizeTimeText(
    time,
    isEnd ? DEFAULT_END_TIME : DEFAULT_START_TIME,
  )
    .split(":")
    .map((item) => Number(item))

  if (
    [year, month, day, hour, minute, second].some((item) => Number.isNaN(item))
  ) {
    return null
  }

  return new Date(year, month - 1, day, hour, minute, second)
}

async function onFilter() {
  if (!appStore.value.settings.showDeviceFeatures) {
    d_no.value = ""
  }

  debugLog("filter:submit", {
    d_no: d_no.value,
    startDate: startDate.value,
    startTime: startTime.value,
    endDate: endDate.value,
    endTime: endTime.value,
  })
  currentPage.value = 1
  await fetchData()
  await fetchChartData()
}

function onReset() {
  d_no.value = ""
  startDate.value = ""
  startTime.value = DEFAULT_START_TIME
  endDate.value = ""
  endTime.value = DEFAULT_END_TIME
  currentPage.value = 1
  debugLog("filter:reset", {
    d_no: d_no.value,
    startDate: startDate.value,
    startTime: startTime.value,
    endDate: endDate.value,
    endTime: endTime.value,
  })
  fetchData()
  fetchChartData()
}

function onPageSizeChange(e) {
  pageSizeIndex.value = e.detail.value
  pageSize.value = pageSizes[e.detail.value]
  currentPage.value = 1
  fetchData()
}

function onChartTypeChange(e) {
  const index = Number(readEventValue(e))
  chartTypeIndex.value = Number.isNaN(index) ? 0 : index
  chartSeries.value = normalizeChartSeries(
    (chartSeries.value || []).map((item) => ({
      ...item,
    })),
    currentChartType.value,
  )
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

function navigateTo(url) {
  navigateToPage(url)
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 40rpx;
  position: relative;
}

.menu-list {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin: 20rpx;
  background-color: #fff;
}

.menu-item {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 30rpx 20rpx;
  margin: 0 10rpx;
  border-radius: 20rpx;
  background-color: #fff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.menu-item:not(.current):active {
  background-color: #f5f5f5;
}

.menu-item.current {
  background-color: #f0f7ff;
}

.menu-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.menu-text {
  flex: 1;
  font-size: 32rpx;
  color: #333;
}

.menu-arrow {
  font-size: 40rpx;
  color: #999;
}

.menu-badge {
  font-size: 24rpx;
  color: #2979ff;
  padding: 4rpx 12rpx;
  background-color: #e3f2fd;
  border-radius: 20rpx;
}

.filter-wrapper {
  margin: 20rpx;
  padding: 30rpx;
  background-color: #fff;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 20;
  isolation: isolate;
}

.filter-item {
  margin-bottom: 24rpx;
  position: relative;
}

.filter-label {
  display: block;
  font-size: 28rpx;
  color: #666;
  margin-bottom: 12rpx;
}

.filter-input,
.datetime-picker {
  width: 100%;
  min-height: 76rpx;
  padding: 0 20rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  font-size: 30rpx;
  color: #333;
  background-color: #f9f9f9;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  position: relative;
  z-index: 22;
  pointer-events: auto;
}

.filter-input :deep(.uni-input-wrapper),
.datetime-picker :deep(.uni-input-wrapper) {
  width: 100%;
  min-height: 76rpx;
  display: flex;
  align-items: center;
}

.filter-input :deep(.uni-input-input),
.filter-input :deep(input),
.datetime-picker :deep(.uni-input-input),
.datetime-picker :deep(input) {
  width: 100%;
  min-height: 76rpx;
  height: 76rpx;
  line-height: 76rpx;
  pointer-events: auto;
  user-select: text;
  -webkit-user-select: text;
  background: transparent;
  color: inherit;
}

.datetime-native-input {
  appearance: none;
  -webkit-appearance: none;
}

.datetime-native-input :deep(.uni-input-input),
.datetime-native-input :deep(input) {
  cursor: pointer;
}


.filter-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
}

.query-btn,
.reset-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 12rpx;
  font-size: 30rpx;
  border: none;
}

.query-btn {
  background-color: #2979ff;
  color: #fff;
}

.reset-btn {
  background-color: #f5f5f5;
  color: #666;
}

.table-wrapper {
  margin: 20rpx;
  position: relative;
  z-index: 1;
}

.table-container {
  background-color: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.table-scroll {
  width: 100%;
  white-space: nowrap;
}

.table-scroll-native {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

.table-scroll-content {
  min-width: 100%;
  display: flex;
  justify-content: flex-start;
}

.table {
  width: 100%;
  min-width: max-content;
}

.table-header {
  display: flex;
  background-color: #f7f9fc;
  border-bottom: 2rpx solid #ebeef5;
  width: 100%;
  min-width: max-content;
}

.table-body {
  width: 100%;
  min-width: max-content;
}

.table-row {
  display: flex;
  border-bottom: 1rpx solid #f0f0f0;
  width: 100%;
  min-width: max-content;
}

.table-cell {
  flex: 1 0 180rpx;
  min-width: 180rpx;
  padding: 24rpx 16rpx;
  box-sizing: border-box;
  font-size: 24rpx;
  color: #666;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  word-break: break-all;
}

.header-cell {
  font-size: 26rpx;
  font-weight: 600;
  color: #333;
}

.empty-data {
  padding: 80rpx;
  text-align: center;
  color: #999;
  font-size: 28rpx;
}

.pagination-wrapper {
  margin: 20rpx;
  padding: 24rpx 30rpx;
  background-color: #fff;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
}

.pagination-controls {
  display: flex;
  align-items: center;
}

.total-text {
  font-size: 26rpx;
  color: #666;
  white-space: nowrap;
  flex-shrink: 0;
}

.pagination-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 0 8rpx;
  overflow: visible;
}

.page-btn {
  width: 56rpx;
  height: 56rpx;
  padding: 0;
  background-color: #2979ff;
  color: #fff;
  border-radius: 8rpx;
  font-size: 36rpx;
  font-weight: bold;
  line-height: 56rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.page-btn[disabled] {
  background-color: #e0e0e0;
  color: #999;
}

.page-info {
  font-size: 26rpx;
  color: #666;
  white-space: nowrap;
  min-width: 80rpx;
  text-align: center;
}

.page-size-picker {
  padding: 10rpx 12rpx;
  background-color: #f5f7fa;
  border: 1rpx solid #e0e0e0;
  border-radius: 8rpx;
  font-size: 22rpx;
  color: #666;
  white-space: nowrap;
  flex-shrink: 0;
}

.chart-wrapper {
  margin: 20rpx;
  padding: 30rpx;
  background-color: #fff;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 1;
}

.chart-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16rpx;
}

.chart-type-picker {
  min-width: 180rpx;
  max-width: 280rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 20rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  background-color: #f9f9f9;
  color: #333;
  font-size: 28rpx;
  box-sizing: border-box;
}

.chart-type-arrow {
  margin-left: 12rpx;
  color: #999;
  font-size: 20rpx;
}
</style>
