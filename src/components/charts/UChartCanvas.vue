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
  animation: {
    type: Boolean,
    default: false,
  },
  updateAnimation: {
    type: Boolean,
    default: false,
  },
  animationDuration: {
    type: Number,
    default: 420,
  },
  stabilizeAppendWidth: {
    type: Boolean,
    default: true,
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
let lastViewportWidth = 0
let lastPointCount = 0
let lastDataSignature = ""
let renderSeq = 0
let zeroRectRetryCount = 0
let lastChartOptions = null
const scrollRef = ref(null)
let delayedRenderTimer = null
const MAX_ZERO_RECT_RETRIES = 60
// Tooltip mousemove throttle — uCharts' showToolTip does a full canvas redraw
// (axes + grid + all series), so we must coalesce move events. 50ms ≈ 20fps,
// plenty of hover responsiveness at a fraction of the CPU cost of 60fps.
const TOOLTIP_MOVE_INTERVAL = 50
let tooltipMoveTimer = null
let tooltipMoveLastAt = 0
let pendingTooltipEvent = null

const isRadialType = computed(() => {
  return props.type === "pie" || props.type === "ring"
})

const hasData = computed(() => {
  // pie / ring charts don't use `categories` — they only need a series with
  // `{name, data}` entries. All other chart types still require both axes.
  if (isRadialType.value) {
    return (props.series || []).some(
      (item) => Number.isFinite(Number(item?.data)) && Number(item?.data) > 0,
    )
  }
  return props.categories.length > 0 && props.series.length > 0
})

watch(
  () => [
    props.type,
    props.categories,
    props.series,
    props.yAxis,
    props.xAxis,
    props.extra,
    props.animation,
    props.updateAnimation,
    props.animationDuration,
    props.stabilizeAppendWidth,
  ],
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
  if (tooltipMoveTimer) {
    clearTimeout(tooltipMoveTimer)
    tooltipMoveTimer = null
  }
  pendingTooltipEvent = null
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

function cloneChartOption(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneChartOption(item))
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneChartOption(item)]),
    )
  }
  return value
}

function buildDataSignature(type, categories, series, yAxis, xAxis, extra) {
  const tailCategory = categories[categories.length - 1] ?? ""
  const seriesTail = (series || [])
    .map((item) => {
      const data = item?.data || []
      return `${item?.name || ""}:${data.length}:${data[data.length - 1] ?? ""}`
    })
    .join("|")
  const axisSignature = JSON.stringify({
    yAxis,
    xAxis,
    extra,
  })
  return `${type}|${categories.length}|${tailCategory}|${seriesTail}|${axisSignature}`
}

function getAnimationDuration() {
  const duration = Number(props.animationDuration)
  return Number.isFinite(duration) && duration > 0 ? duration : 420
}

function resolveCanvasWidth({ targetWidth, viewportWidth, radial, pointCount, pointStep }) {
  if (radial || !props.stabilizeAppendWidth || !lastChartWidth || !lastPointCount) {
    return targetWidth
  }

  if (lastViewportWidth && Math.abs(viewportWidth - lastViewportWidth) > 1) {
    return targetWidth
  }

  const pointGrowth = pointCount - lastPointCount
  const widthGrowth = targetWidth - lastChartWidth
  const smallAppendGrowth = pointGrowth > 0 && pointGrowth <= 2
  const smallWidthGrowth = widthGrowth > 0 && widthGrowth <= pointStep * 2 + 2

  return smallAppendGrowth && smallWidthGrowth ? lastChartWidth : targetWidth
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

// uCharts' tooltip drawing path calls `context.setTextBaseline('normal')`
// (see node_modules/@qiun/ucharts/u-charts.js around the tooltip text loop).
// On H5 the context returned by `uni.createCanvasContext` already has
// `setTextAlign`, so uCharts skips its internal polyfill and forwards the
// call to a wrapper backed by the real CanvasRenderingContext2D — and modern
// browsers reject `'normal'` as an invalid CanvasTextBaseline enum, throwing
// every time the tooltip repaints during touchmove / mousemove. We patch the
// context once per creation and remap the illegal value to `'alphabetic'`,
// which matches uCharts' intent (text drawn from a baseline anchor) without
// touching node_modules. Idempotent via a marker flag.
function patchTextBaseline(context) {
  if (!context || context.__baselinePatched) return
  const original = context.setTextBaseline
  if (typeof original !== "function") return
  context.setTextBaseline = function patchedSetTextBaseline(value) {
    const safe = value === "normal" ? "alphabetic" : value
    return original.call(this, safe)
  }
  context.__baselinePatched = true
}

// Smart x-axis formatter for timestamps.
//
// Two important facts about uCharts' x-axis pipeline drive this:
// 1. It thins labels itself via `xAxis.labelCount` (see
//    drawXAxis in node_modules/@qiun/ucharts/u-charts.js). For every index
//    that should be hidden, it passes an empty string to the formatter.
// 2. It renders the formatted string with a single `context.fillText` call,
//    which does NOT honor `\n`. So any multi-line trick we attempted before
//    was visually a lie — all the text collided on one line. Labels MUST be
//    single-line.
//
// Strategy: we rely on labelCount to decide WHICH ticks get a label; this
// formatter only decides HOW each surviving tick is written:
//   - first / last tick         → `MM-DD HH:MM` (date anchor)
//   - day transition vs prev    → `MM-DD HH:MM` (calendar marker)
//   - everything else           → `HH:MM`       (most labels, very short)
//
// `opts.categories` is the untouched original array, even for indices that
// uCharts has blanked out, so we can inspect neighbours when making the
// day-transition decision.
function formatCompactXAxis(value, index, opts) {
  if (value === "" || value === undefined || value === null) return ""

  const raw = String(value).replace("T", " ")
  const match = raw.match(/(\d{4})[-/](\d{2})[-/](\d{2})\s+(\d{2}):(\d{2})/)
  if (!match) {
    const timeOnly = raw.match(/(\d{2}):(\d{2})/)
    return timeOnly ? `${timeOnly[1]}:${timeOnly[2]}` : raw
  }

  const mm = match[2]
  const dd = match[3]
  const hh = match[4]
  const mi = match[5]
  const short = `${hh}:${mi}`
  const full = `${mm}-${dd} ${hh}:${mi}`

  const categories = opts && Array.isArray(opts.categories) ? opts.categories : []
  if (!categories.length) return short

  const lastIdx = categories.length - 1
  if (index === 0 || index === lastIdx) return full

  const prev = String(categories[index - 1] ?? "").replace("T", " ")
  const prevMatch = prev.match(/(\d{4})[-/](\d{2})[-/](\d{2})/)
  if (prevMatch && `${prevMatch[2]}-${prevMatch[3]}` !== `${mm}-${dd}`) {
    return full
  }
  return short
}

async function renderChart() {
  const currentSeq = ++renderSeq
  if (!hasData.value) {
    chart = null
    canvasWidth.value = 0
    lastChartWidth = 0
    lastChartHeight = 0
    lastViewportWidth = 0
    lastPointCount = 0
    lastDataSignature = ""
    lastChartOptions = null
    zeroRectRetryCount = 0
    cancelPendingTooltip()
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
  const radial = isRadialType.value
  // Data-point density vs label density are treated as SEPARATE problems:
  //   - data points: every sample is still drawn (high density, smooth lines)
  //   - labels: explicitly thinned below by xAxis.labelCount / formatter
  // The width math keeps the tight packing from the previous iteration; only
  // the label layer has changed.
  // Pie/ring charts don't scroll horizontally — canvas matches the viewport.
  const pointCount = props.categories.length
  const minPointWidth = isCompact ? 22 : 36
  const horizontalPadding = isCompact ? 24 : 20
  const estimatedWidth = pointCount * minPointWidth + horizontalPadding
  const maxCanvasWidth = rect.width * (isCompact ? 2 : 3)
  const targetWidth = radial
    ? rect.width
    : Math.max(rect.width, Math.min(estimatedWidth, maxCanvasWidth))
  const resolvedWidth = resolveCanvasWidth({
    targetWidth,
    viewportWidth: rect.width,
    radial,
    pointCount,
    pointStep: minPointWidth,
  })

  // Label-density control: we want roughly one label per `labelPitch` px of
  // canvas. `labelCount` then feeds uCharts' built-in tick thinning:
  //   ratio = ceil(pointCount / (labelCount - 1))
  // Every ratio-th category keeps its text, the rest get an empty string
  // passed to our formatter. We also align `gridEval` to the same ratio so
  // grid lines sit under labelled ticks instead of between them.
  const labelPitch = isCompact ? 96 : 120
  const minLabels = 3
  const maxLabels = isCompact ? 6 : 10
  const targetLabels = Math.max(
    minLabels,
    Math.min(Math.max(pointCount, 1), Math.round(resolvedWidth / labelPitch), maxLabels),
  )
  const xLabelCount = Math.max(minLabels, Math.min(Math.max(pointCount, 1), targetLabels))
  const xLabelRatio = Math.max(
    1,
    Math.ceil(Math.max(pointCount, 1) / Math.max(1, xLabelCount - 1)),
  )
  canvasWidth.value = resolvedWidth
  const chartType = props.type === "bar" ? "column" : props.type
  const chartHeight = rect.height
  const chartCategories = cloneChartOption(props.categories || [])
  const chartSeries = cloneChartOption(props.series || [])
  const chartYAxis = cloneChartOption(props.yAxis || {})
  const chartXAxis = cloneChartOption(props.xAxis || {})
  const chartExtra = cloneChartOption(props.extra || {})
  const dataSignature = buildDataSignature(
    chartType,
    chartCategories,
    chartSeries,
    chartYAxis,
    chartXAxis,
    chartExtra,
  )
  const chartOptions = radial
    ? {
        type: chartType,
        width: resolvedWidth,
        height: chartHeight,
        pixelRatio,
        animation: false,
        duration: getAnimationDuration(),
        background: "#FFFFFF",
        series: chartSeries,
        enableScroll: false,
        dataLabel: true,
        legend: {
          show: true,
          position: "bottom",
          float: "center",
          padding: isCompact ? 4 : 6,
          margin: isCompact ? 6 : 10,
          fontSize: isCompact ? 10 : 12,
          lineHeight: isCompact ? 14 : 16,
          itemGap: isCompact ? 12 : 16,
        },
        padding: isCompact ? [10, 10, 10, 10] : [14, 12, 14, 12],
        extra: {
          tooltip: {
            legendShape: "auto",
          },
          pie: {
            activeOpacity: 0.5,
            activeRadius: 6,
            offsetAngle: 0,
            labelWidth: 12,
            border: true,
            borderWidth: 2,
            borderColor: "#FFFFFF",
          },
          ring: {
            ringWidth: isCompact ? 28 : 36,
            activeOpacity: 0.5,
            activeRadius: 6,
            offsetAngle: 0,
            labelWidth: 12,
            border: true,
            borderWidth: 2,
            borderColor: "#FFFFFF",
            centerColor: "#FFFFFF",
          },
          ...chartExtra,
        },
      }
    : {
        type: chartType,
        width: resolvedWidth,
        height: chartHeight,
        pixelRatio,
        animation: false,
        duration: getAnimationDuration(),
        background: "#FFFFFF",
        categories: chartCategories,
        series: chartSeries,
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
          // Explicit label-density control: thin to `xLabelCount` ticks and align
          // grid lines with them. Data points themselves are NOT reduced.
          labelCount: xLabelCount,
          gridEval: xLabelRatio,
          formatter: chartXAxis.formatter || formatCompactXAxis,
          scrollShow: false,
          ...chartXAxis,
        },
        yAxis: {
          disabled: false,
          splitNumber: 5,
          fontSize: isCompact ? 7 : 9,
          padding: isCompact ? 2 : 6,
          ...chartYAxis,
        },
        extra: {
          tooltip: {
            legendShape: "auto",
            // Prepend the current sample's full timestamp as a header row in the
            // tooltip. uCharts reads `opts.categories[index]` directly (see
            // drawToolTipText in u-charts.js), so whatever raw timestamp the page
            // feeds into `chartCategories` is what shows up.
            showCategory: true,
          },
          column: {
            width: isCompact ? 14 : 18,
            categoryGap: isCompact ? 2 : 4,
          },
          ...chartExtra,
        },
      }

  const isInitialCreate = !chart
  const shouldRecreate =
    isInitialCreate ||
    lastChartWidth !== resolvedWidth ||
    lastChartHeight !== chartHeight ||
    currentSeq !== renderSeq
  const renderOptions = {
    ...chartOptions,
    animation:
      props.animation && (isInitialCreate || (!shouldRecreate && props.updateAnimation)),
  }

  if (!shouldRecreate && dataSignature === lastDataSignature) {
    lastViewportWidth = rect.width
    lastPointCount = pointCount
    resetScrollPosition()
    return
  }

  if (shouldRecreate) {
    const context = uni.createCanvasContext(canvasId, instance?.proxy)
    if (!context) {
      scheduleRender(120)
      return
    }
    patchTextBaseline(context)
    chart = new uCharts({
      ...renderOptions,
      context,
    })
    lastChartWidth = resolvedWidth
    lastChartHeight = chartHeight
    resetScrollPosition()
  } else {
    chart.updateData(renderOptions)
  }

  lastViewportWidth = rect.width
  lastPointCount = pointCount
  lastChartOptions = renderOptions
  lastDataSignature = dataSignature
}

function hideTooltip() {
  if (!chart || !lastChartOptions) return
  chart.updateData({
    ...lastChartOptions,
    animation: false,
  })
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
  cancelPendingTooltip()
  tooltipMoveLastAt = Date.now()
  showToolTip(normalizeTooltipEvent(event))
}

function handleMove(event) {
  // Every move triggers a full canvas redraw in uCharts, so we MUST throttle.
  // Coalesce bursts into one tail-call per TOOLTIP_MOVE_INTERVAL window.
  const normalized = normalizeTooltipEvent(event)
  const now = Date.now()
  const elapsed = now - tooltipMoveLastAt

  if (elapsed >= TOOLTIP_MOVE_INTERVAL) {
    cancelPendingTooltip()
    tooltipMoveLastAt = now
    showToolTip(normalized)
    return
  }

  pendingTooltipEvent = normalized
  if (tooltipMoveTimer) return
  tooltipMoveTimer = setTimeout(() => {
    tooltipMoveTimer = null
    const evt = pendingTooltipEvent
    pendingTooltipEvent = null
    if (!evt) return
    tooltipMoveLastAt = Date.now()
    showToolTip(evt)
  }, TOOLTIP_MOVE_INTERVAL - elapsed)
}

function handleLeave() {
  cancelPendingTooltip()
  // One repaint to clear the tooltip overlay; NOT repeated per move.
  hideTooltip()
}

function cancelPendingTooltip() {
  if (tooltipMoveTimer) {
    clearTimeout(tooltipMoveTimer)
    tooltipMoveTimer = null
  }
  pendingTooltipEvent = null
}

function showToolTip(event) {
  if (!chart || !event) return

  chart.showToolTip(event, {
    formatter: (item) => {
      const unit = item.unit ? ` ${item.unit}` : ""
      return `${item.name}: ${item.data ?? "-"}${unit}`
    },
  })
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
