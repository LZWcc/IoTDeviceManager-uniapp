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
      <view ref="scrollRef" class="canvas-scroll canvas-scroll-native">
        <view class="canvas-box" :style="{ height, width: `${canvasWidth}px` }">
          <canvas
            :id="canvasId"
            :canvas-id="canvasId"
            class="uchart-canvas"
            :style="{ width: `${canvasWidth}px`, height }"
            @tap="handleTap"
            @click="handleTap"
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
let resizeObserver = null
let lastChartWidth = 0
let lastChartHeight = 0
let lastDataSignature = ""
let renderSeq = 0
let tooltipHideTimer = null
let zeroRectRetryCount = 0
let lastChartOptions = null
const scrollRef = ref(null)
let delayedRenderTimer = null
const MAX_ZERO_RECT_RETRIES = 60

const hasData = computed(() => {
  return props.categories.length > 0 && props.series.length > 0
})

watch(
  () => [props.type, props.categories, props.series, props.yAxis, props.xAxis, props.extra],
  () => {
    scheduleRender()
  },
)

watch(
  hasData,
  (value) => {
    if (!value) {
      zeroRectRetryCount = 0
      if (delayedRenderTimer) {
        clearTimeout(delayedRenderTimer)
        delayedRenderTimer = null
      }
      return
    }

    zeroRectRetryCount = 0
    scheduleRender(30)
    if (delayedRenderTimer) {
      clearTimeout(delayedRenderTimer)
    }
    delayedRenderTimer = setTimeout(() => {
      if (hasData.value) {
        scheduleRender(30)
      }
    }, 260)
  },
  { immediate: true },
)

onMounted(async () => {
  await renderChart()

  // #ifdef H5
  window.addEventListener("resize", scheduleRender)
  if (typeof ResizeObserver !== "undefined") {
    const viewportElement = document.getElementById(viewportId)
    if (viewportElement) {
      resizeObserver = new ResizeObserver(() => {
        scheduleRender(60)
      })
      resizeObserver.observe(viewportElement)
    }
  }
  // #endif
})

onUnmounted(() => {
  // #ifdef H5
  window.removeEventListener("resize", scheduleRender)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  // #endif

  if (resizeTimer) {
    clearTimeout(resizeTimer)
    resizeTimer = null
  }
  if (tooltipHideTimer) {
    clearTimeout(tooltipHideTimer)
    tooltipHideTimer = null
  }
  if (delayedRenderTimer) {
    clearTimeout(delayedRenderTimer)
    delayedRenderTimer = null
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
    if (zeroRectRetryCount < MAX_ZERO_RECT_RETRIES) {
      zeroRectRetryCount += 1
      const retryDelay = zeroRectRetryCount < 12 ? 120 : 220
      scheduleRender(retryDelay)
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
    resetScrollPosition()
    return
  }

  if (shouldRecreate) {
    const context = uni.createCanvasContext(canvasId, instance?.proxy)
    if (!context) {
      scheduleRender(120)
      return
    }
    chart = new uCharts({
      ...chartOptions,
      context,
    })
    lastChartWidth = resolvedWidth
    lastChartHeight = chartHeight
    resetScrollPosition()
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

function resetScrollPosition() {
  // #ifdef H5
  const el = scrollRef.value
  if (el && typeof el.scrollLeft === "number") {
    el.scrollLeft = 0
  }
  // #endif
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

function normalizeTooltipEvent(event) {
  const point = extractTooltipPoint(event)
  if (!point) return event

  const normalized = {
    x: point.x,
    y: point.y,
  }

  return {
    ...(event || {}),
    changedTouches: [normalized],
    touches: [normalized],
    mp: {
      ...(event?.mp || {}),
      changedTouches: [normalized],
      touches: [normalized],
    },
  }
}

function extractTooltipPoint(event) {
  const detailX = Number(event?.detail?.x)
  const detailY = Number(event?.detail?.y)
  if (Number.isFinite(detailX) && Number.isFinite(detailY)) {
    return { x: detailX, y: detailY }
  }

  const touch =
    event?.changedTouches?.[0] ||
    event?.touches?.[0] ||
    event?.mp?.changedTouches?.[0]
  const touchX = Number(touch?.x)
  const touchY = Number(touch?.y)
  if (Number.isFinite(touchX) && Number.isFinite(touchY)) {
    return { x: touchX, y: touchY }
  }

  // #ifdef H5
  const clientX = Number(touch?.clientX ?? event?.clientX)
  const clientY = Number(touch?.clientY ?? event?.clientY)
  if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
    const canvasEl = document.getElementById(canvasId)
    if (canvasEl) {
      const rect = canvasEl.getBoundingClientRect()
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
      const y = Math.max(0, Math.min(clientY - rect.top, rect.height))
      return { x, y }
    }
  }
  // #endif

  return null
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
