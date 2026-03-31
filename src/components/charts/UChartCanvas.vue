<template>
  <view class="uchart-wrapper">
    <view v-if="title" class="chart-title">
      <text>{{ title }}</text>
    </view>
    <view
      v-if="hasData"
      :id="viewportId"
      class="canvas-viewport"
      :style="{ minHeight: height }"
    >
      <!-- #ifdef H5 -->
      <view class="canvas-scroll canvas-scroll-native">
        <view class="canvas-box" :style="{ height, width: `${canvasWidth}px` }">
          <canvas
            :id="canvasId"
            :canvas-id="canvasId"
            class="uchart-canvas"
            :style="{ width: `${canvasWidth}px`, height }"
            @click="handleTap"
            @tap="handleTap"
            @touchstart="handleTap"
            @mousemove="handleMove"
            @touchmove="handleMove"
            @mouseleave="handleLeave"
          />
        </view>
      </view>
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <scroll-view
        class="canvas-scroll"
        scroll-x
        :show-scrollbar="false"
        enhanced
      >
        <view class="canvas-box" :style="{ height, width: `${canvasWidth}px` }">
          <canvas
            :id="canvasId"
            :canvas-id="canvasId"
            class="uchart-canvas"
            :style="{ width: `${canvasWidth}px`, height }"
            @tap="handleTap"
            @touchstart="handleTap"
            @touchmove="handleMove"
          />
        </view>
      </scroll-view>
      <!-- #endif -->
    </view>
    <view v-else class="empty-state" :style="{ height }">
      <text>暂无图表数据</text>
    </view>
  </view>
</template>

<script setup>
import {
  computed,
  getCurrentInstance,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import uCharts from "@qiun/ucharts"

const props = defineProps({
  title: {
    type: String,
    default: "",
  },
  type: {
    type: String,
    default: "line",
  },
  categories: {
    type: Array,
    default: () => [],
  },
  series: {
    type: Array,
    default: () => [],
  },
  height: {
    type: String,
    default: "620rpx",
  },
  yAxis: {
    type: Object,
    default: () => ({}),
  },
  xAxis: {
    type: Object,
    default: () => ({}),
  },
  extra: {
    type: Object,
    default: () => ({}),
  },
  enableScroll: {
    type: Boolean,
    default: false,
  },
})

const instance = getCurrentInstance()
const canvasId = `uchart-${instance?.uid || Date.now()}`
const viewportId = `uchart-viewport-${instance?.uid || Date.now()}`
const pixelRatio = 1
const canvasWidth = ref(0)
let chart = null
let resizeTimer = null
let lastChartWidth = 0
let lastChartHeight = 0
let lastDataSignature = ""
let renderSeq = 0
let tooltipHideTimer = null
let zeroRectRetryCount = 0
let lastChartOptions = null

const hasData = computed(() => {
  return props.categories.length > 0 && props.series.length > 0
})

watch(
  () => [props.type, props.categories, props.series, props.yAxis, props.xAxis, props.extra],
  () => {
    scheduleRender()
  },
)

onMounted(async () => {
  await renderChart()

  // #ifdef H5
  window.addEventListener("resize", scheduleRender)
  // #endif
})

onUnmounted(() => {
  // #ifdef H5
  window.removeEventListener("resize", scheduleRender)
  // #endif

  if (resizeTimer) {
    clearTimeout(resizeTimer)
    resizeTimer = null
  }
  if (tooltipHideTimer) {
    clearTimeout(tooltipHideTimer)
    tooltipHideTimer = null
  }
  chart = null
  lastChartOptions = null
})

function scheduleRender(delay = 80) {
  if (resizeTimer) {
    clearTimeout(resizeTimer)
  }

  resizeTimer = setTimeout(() => {
    renderChart()
  }, delay)
}

function buildDataSignature(type, categories, series) {
  const tailCategory = categories[categories.length - 1] ?? ""
  const seriesTail = (series || [])
    .map((item) => {
      const data = item?.data || []
      return `${item?.name || ""}:${data.length}:${data[data.length - 1] ?? ""}`
    })
    .join("|")
  return `${type}|${categories.length}|${tailCategory}|${seriesTail}`
}

async function getCanvasRect() {
  await nextTick()

  return new Promise((resolve) => {
    uni
      .createSelectorQuery()
      .in(instance?.proxy)
      .select(`#${viewportId}`)
      .boundingClientRect((rect) => {
        resolve(rect)
      })
      .exec()
  })
}

function formatCompactXAxis(value) {
  if (!value) return ""

  const normalized = String(value).replace("T", " ")
  const match = normalized.match(
    /(\d{4})[-/](\d{2})[-/](\d{2})\s+(\d{2}:\d{2})/,
  )

  if (match) {
    return `${match[2]}-${match[3]}\n${match[4]}`
  }

  return normalized
}

async function renderChart() {
  const currentSeq = ++renderSeq
  if (!hasData.value) {
    chart = null
    canvasWidth.value = 0
    lastChartWidth = 0
    lastChartHeight = 0
    lastDataSignature = ""
    lastChartOptions = null
    zeroRectRetryCount = 0
    if (tooltipHideTimer) {
      clearTimeout(tooltipHideTimer)
      tooltipHideTimer = null
    }
    return
  }

  const rect = await getCanvasRect()
  if (currentSeq !== renderSeq) return
  if (!rect?.width || !rect?.height) {
    if (zeroRectRetryCount < 8) {
      zeroRectRetryCount += 1
      scheduleRender(120)
    }
    return
  }
  zeroRectRetryCount = 0

  const isCompact = rect.width <= 420
  const minPointWidth = isCompact ? 96 : 88
  const horizontalPadding = isCompact ? 24 : 20
  const estimatedWidth = props.categories.length * minPointWidth + horizontalPadding
  const maxCanvasWidth = rect.width * (isCompact ? 3 : 4)
  const resolvedWidth = Math.max(rect.width, Math.min(estimatedWidth, maxCanvasWidth))
  canvasWidth.value = resolvedWidth
  const chartType = props.type === "bar" ? "column" : props.type
  const chartHeight = rect.height
  const dataSignature = buildDataSignature(
    chartType,
    props.categories || [],
    props.series || [],
  )
  const chartOptions = {
    type: chartType,
    width: resolvedWidth,
    height: chartHeight,
    pixelRatio,
    animation: false,
    background: "#FFFFFF",
    categories: props.categories,
    series: props.series,
    enableScroll: false,
    dataLabel: false,
    legend: {
      show: true,
      position: "top",
      float: "center",
      padding: isCompact ? 2 : 4,
      margin: isCompact ? 4 : 8,
      fontSize: isCompact ? 8 : 10,
      lineHeight: isCompact ? 10 : 12,
      itemGap: isCompact ? 8 : 12,
    },
    padding: isCompact ? [8, 10, 32, 8] : [14, 12, 12, 8],
    xAxis: {
      disableGrid: false,
      rotateLabel: false,
      rotateAngle: 0,
      fontSize: isCompact ? 8 : 10,
      lineHeight: isCompact ? 18 : 16,
      marginTop: isCompact ? 8 : 4,
      formatter: props.xAxis.formatter || (isCompact ? formatCompactXAxis : undefined),
      scrollShow: false,
      ...props.xAxis,
    },
    yAxis: {
      disabled: false,
      splitNumber: 5,
      fontSize: isCompact ? 7 : 9,
      padding: isCompact ? 2 : 6,
      ...props.yAxis,
    },
    extra: {
      tooltip: {
        legendShape: "auto",
      },
      column: {
        width: isCompact ? 14 : 18,
        categoryGap: isCompact ? 2 : 4,
      },
      ...props.extra,
    },
  }

  const shouldRecreate =
    !chart ||
    lastChartWidth !== resolvedWidth ||
    lastChartHeight !== chartHeight ||
    currentSeq !== renderSeq

  if (!shouldRecreate && dataSignature === lastDataSignature) {
    return
  }

  if (shouldRecreate) {
    const context = uni.createCanvasContext(canvasId, instance?.proxy)
    if (!context) return
    chart = new uCharts({
      ...chartOptions,
      context,
    })
    lastChartWidth = resolvedWidth
    lastChartHeight = chartHeight
  } else {
    chart.updateData(chartOptions)
  }

  lastChartOptions = chartOptions
  lastDataSignature = dataSignature
}

function scheduleHideTooltip(delay = 900) {
  if (tooltipHideTimer) {
    clearTimeout(tooltipHideTimer)
  }

  tooltipHideTimer = setTimeout(() => {
    hideTooltip()
  }, delay)
}

function hideTooltip() {
  if (!chart || !lastChartOptions) return
  chart.updateData(lastChartOptions)
}

function handleTap(event) {
  showToolTip(normalizeTooltipEvent(event))
}

function handleMove(event) {
  showToolTip(normalizeTooltipEvent(event))
}

function handleLeave() {
  scheduleHideTooltip(120)
}

function showToolTip(event) {
  if (!chart || !event) return

  chart.showToolTip(event, {
    formatter: (item) => {
      const unit = item.unit ? ` ${item.unit}` : ""
      return `${item.name}: ${item.data ?? "-"}${unit}`
    },
  })
  scheduleHideTooltip()
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
}

function getCanvasBoundingRect() {
  // #ifdef H5
  if (typeof document !== "undefined") {
    const canvasEl = document.getElementById(canvasId)
    if (canvasEl && typeof canvasEl.getBoundingClientRect === "function") {
      return canvasEl.getBoundingClientRect()
    }
  }
  // #endif
  return null
}

function convertClientPointToCanvas(clientX, clientY) {
  const rect = getCanvasBoundingRect()
  if (!rect) return null

  const x = clientX - rect.left
  const y = clientY - rect.top

  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null
  return { x, y }
}

function convertPagePointToCanvas(pageX, pageY) {
  // #ifdef H5
  const win = typeof window !== "undefined" ? window : null
  const scrollX = win ? win.pageXOffset || 0 : 0
  const scrollY = win ? win.pageYOffset || 0 : 0
  return convertClientPointToCanvas(pageX - scrollX, pageY - scrollY)
  // #endif
  // #ifndef H5
  return null
  // #endif
}

function resolveTouchPoint(touchPoint) {
  if (!touchPoint) return null

  if (isFiniteNumber(touchPoint.x) && isFiniteNumber(touchPoint.y)) {
    return { x: touchPoint.x, y: touchPoint.y }
  }

  if (isFiniteNumber(touchPoint.clientX) && isFiniteNumber(touchPoint.clientY)) {
    return convertClientPointToCanvas(touchPoint.clientX, touchPoint.clientY)
  }

  if (isFiniteNumber(touchPoint.pageX) && isFiniteNumber(touchPoint.pageY)) {
    return convertPagePointToCanvas(touchPoint.pageX, touchPoint.pageY)
  }

  return null
}

function extractTooltipPoint(event) {
  if (!event) return null

  if (isFiniteNumber(event?.detail?.x) && isFiniteNumber(event?.detail?.y)) {
    return { x: event.detail.x, y: event.detail.y }
  }

  if (isFiniteNumber(event?.x) && isFiniteNumber(event?.y)) {
    return { x: event.x, y: event.y }
  }

  const touchPoint =
    event?.changedTouches?.[0] ||
    event?.touches?.[0] ||
    event?.mp?.changedTouches?.[0] ||
    event?.mp?.touches?.[0]
  const resolvedTouch = resolveTouchPoint(touchPoint)
  if (resolvedTouch) return resolvedTouch

  if (isFiniteNumber(event?.offsetX) && isFiniteNumber(event?.offsetY)) {
    return { x: event.offsetX, y: event.offsetY }
  }

  if (isFiniteNumber(event?.clientX) && isFiniteNumber(event?.clientY)) {
    return convertClientPointToCanvas(event.clientX, event.clientY)
  }

  if (isFiniteNumber(event?.pageX) && isFiniteNumber(event?.pageY)) {
    return convertPagePointToCanvas(event.pageX, event.pageY)
  }

  return null
}

function normalizeTooltipEvent(event) {
  if (!event) return event

  const point = extractTooltipPoint(event)
  if (!point) return event

  const touchPoint = { x: point.x, y: point.y }
  const detail = {
    ...(event.detail || {}),
    x: point.x,
    y: point.y,
  }
  const mp = {
    ...(event.mp || {}),
    detail: {
      ...(event?.mp?.detail || {}),
      x: point.x,
      y: point.y,
    },
    changedTouches: event?.mp?.changedTouches?.length
      ? event.mp.changedTouches
      : [touchPoint],
    touches: event?.mp?.touches?.length ? event.mp.touches : [touchPoint],
  }

  return {
    ...event,
    detail,
    x: point.x,
    y: point.y,
    changedTouches: event?.changedTouches?.length ? event.changedTouches : [touchPoint],
    touches: event?.touches?.length ? event.touches : [touchPoint],
    mp,
  }
}
</script>

<style scoped>
.uchart-wrapper {
  width: 100%;
}

.canvas-scroll {
  width: 100%;
  white-space: nowrap;
}

.canvas-scroll-native {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

.canvas-viewport {
  width: 100%;
  overflow: hidden;
}

.chart-title {
  margin-bottom: 12rpx;
  text-align: center;
  font-size: 22rpx;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
}

.canvas-box {
  min-width: 100%;
}

.uchart-canvas {
  height: 100%;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 28rpx;
  background-color: #f5f5f5;
  border-radius: 12rpx;
}
</style>
