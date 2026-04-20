<template>
  <view class="datetime-field" :class="{ 'is-open': panelVisible }">
    <view
      class="datetime-trigger"
      :class="{ 'is-placeholder': !displayValue }"
      :data-debug-id="debugId || null"
      @click="openPanel"
    >
      <text>{{ displayValue || placeholder }}</text>
    </view>

    <view v-if="panelVisible" class="datetime-mask" @click="handleCancel"></view>

    <view v-if="panelVisible" class="datetime-popup" @click.stop>
      <view class="popup-toolbar">
        <text class="toolbar-action cancel" @click="handleCancel">取消</text>
        <text class="toolbar-title">{{ titleText }}</text>
        <text class="toolbar-action confirm" @click="handleConfirm">确定</text>
      </view>

      <view class="popup-tabs">
        <view
          class="popup-tab"
          :class="{ 'is-active': activeTab === 'start' }"
          @click="switchTab('start')"
        >
          <text class="popup-tab-label">{{ startLabel }}</text>
          <text class="popup-tab-value">{{ formatDraftDateTime(draftStart) }}</text>
        </view>
        <view
          class="popup-tab"
          :class="{ 'is-active': activeTab === 'end' }"
          @click="switchTab('end')"
        >
          <text class="popup-tab-label">{{ endLabel }}</text>
          <text class="popup-tab-value">{{ formatDraftDateTime(draftEnd) }}</text>
        </view>
      </view>

      <picker-view
        :key="pickerViewKey"
        class="picker-view"
        :indicator-style="indicatorStyle"
        :value="activePickerValue"
        @change="onPickerChange"
      >
        <picker-view-column
          v-for="column in activeColumns"
          :key="column.type"
        >
          <view
            v-for="item in column.items"
            :key="item"
            class="picker-item"
          >{{ item }}{{ column.suffix }}</view>
        </picker-view-column>
      </picker-view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, watch } from "vue"

// itemHeight 必须与 .picker-item 的 line-height 完全一致。
const ITEM_HEIGHT_RPX = 88
const indicatorStyle = `height: ${ITEM_HEIGHT_RPX}rpx; background: rgba(47, 125, 246, 0.10);`

const COLUMN_TYPES = ["year", "month", "day", "hour", "minute", "second"]
const COLUMN_SUFFIX = {
  year: "年",
  month: "月",
  day: "日",
  hour: "时",
  minute: "分",
  second: "秒",
}

const props = defineProps({
  field: { type: String, default: "start" },
  startValue: { type: String, default: "" },
  endValue: { type: String, default: "" },
  placeholder: { type: String, default: "请选择日期时间" },
  title: { type: String, default: "" },
  startLabel: { type: String, default: "开始时间" },
  endLabel: { type: String, default: "结束时间" },
  defaultStartTime: { type: String, default: "00:00:00" },
  defaultEndTime: { type: String, default: "23:59:59" },
  yearSpan: { type: Number, default: 10 },
  debugId: { type: String, default: "" },
})

const emit = defineEmits([
  "update:startValue",
  "update:endValue",
  "change",
  "confirm",
  "cancel",
  "open",
  "close",
])

const panelVisible = ref(false)
const activeTab = ref(normalizeField(props.field))
// nowRef 是整个组件唯一的上界参考。任何列数据 / 任何 draft 归一化 / 任何
// 输入解析都必须走这个值。它在每次 openPanel / syncStateFromProps 时刷新，
// 保证弹层打开时的列数据永远匹配当前时刻。
const nowRef = ref(getNowDateTime())
const yearOptions = ref(
  createYearOptions([], props.yearSpan, nowRef.value.year),
)
const draftStart = ref(normalizeDraft(createFallbackDateTime(props.defaultStartTime)))
const draftEnd = ref(normalizeDraft(createFallbackDateTime(props.defaultEndTime)))
// pickerViewKey 仅在「打开弹层 / 切换 tab / 用户原始落点被裁剪」三种情况下 bump，
// 让 picker-view 在正常滚动里完整完成原生 snap 动画，不被中途卸载。
const sessionVersion = ref(0)

const titleText = computed(() => props.title || "选择日期时间范围")

const displayValue = computed(() => {
  const value = props.field === "end" ? props.endValue : props.startValue
  return formatDateTimeText(value)
})

const activeDraft = computed(() =>
  activeTab.value === "end" ? draftEnd.value : draftStart.value,
)

// activeColumns 是唯一来源 —— 列里任何时刻都不应该出现超出 nowRef 的值。
const activeColumns = computed(() => buildColumns(activeDraft.value))

// activePickerValue 由 draft + columns 推导得到。当列因为跨越 "now-prefix"
// 边界而收缩时，索引会在 buildPickerValueFromDraft 里自动被 clamp 到新列长。
const activePickerValue = computed(() =>
  buildPickerValueFromDraft(activeDraft.value, activeColumns.value),
)

const pickerViewKey = computed(
  () => `${activeTab.value}-${sessionVersion.value}`,
)

watch(
  () => [props.startValue, props.endValue, props.field, props.yearSpan],
  () => {
    if (!panelVisible.value) {
      syncStateFromProps(normalizeField(props.field))
    }
  },
  { immediate: true },
)

// ---------- helpers ----------

function padNumber(value) {
  return String(value).padStart(2, "0")
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function normalizeField(value) {
  return value === "end" ? "end" : "start"
}

function createNumberOptions(start, end) {
  const length = Math.max(end - start + 1, 0)
  return Array.from({ length }, (_, i) => padNumber(start + i))
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function parseTimeParts(timeText) {
  const safe = String(timeText || "00:00:00").trim()
  const [hh = "0", mm = "0", ss = "0"] = safe.split(":")
  const hour = Number(hh)
  const minute = Number(mm)
  const second = Number(ss)
  return {
    hour: Number.isNaN(hour) ? 0 : clamp(hour, 0, 23),
    minute: Number.isNaN(minute) ? 0 : clamp(minute, 0, 59),
    second: Number.isNaN(second) ? 0 : clamp(second, 0, 59),
  }
}

function createFallbackDateTime(defaultTime) {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    ...parseTimeParts(defaultTime),
  }
}

function getNowDateTime() {
  const n = new Date()
  return {
    year: n.getFullYear(),
    month: n.getMonth() + 1,
    day: n.getDate(),
    hour: n.getHours(),
    minute: n.getMinutes(),
    second: n.getSeconds(),
  }
}

function compareDateTime(a, b) {
  return (
    new Date(a.year, a.month - 1, a.day, a.hour, a.minute, a.second).getTime() -
    new Date(b.year, b.month - 1, b.day, b.hour, b.minute, b.second).getTime()
  )
}

// 所有 draft 必须经过 normalizeDraft。这里做两件事：
// 1. 把年/月/日/时/分/秒逐字段合法化（月份 1-12、当月天数、时分秒在自然范围内）
// 2. 按 bound（默认为 nowRef.value）做 "prefix-chain truncation"：任何与 bound
//    同前缀的子段都会被 bound 的对应字段截断；只要前缀小于 bound，子段就自由取值。
//
// 这是所有"未来值"从源头被挡掉的地方 —— 调用方不再需要额外的 clampToNow。
function normalizeDraft(dt, bound = nowRef.value) {
  const years = yearOptions.value
  const rawYear = Number(dt?.year) || bound.year
  const minYear = years.length ? Number(years[0]) : Math.min(rawYear, bound.year)
  const maxYear = bound.year
  const year = clamp(rawYear, minYear, maxYear)

  const rawMonth = clamp(Number(dt?.month) || 1, 1, 12)
  const monthMax = year === bound.year ? bound.month : 12
  const month = Math.min(rawMonth, monthMax)

  const daysInMonth = getDaysInMonth(year, month)
  const rawDay = clamp(Number(dt?.day) || 1, 1, daysInMonth)
  const dayMax =
    year === bound.year && month === bound.month
      ? Math.min(bound.day, daysInMonth)
      : daysInMonth
  const day = Math.min(rawDay, dayMax)

  const rawHour = clamp(Number(dt?.hour) || 0, 0, 23)
  const hourMax =
    year === bound.year && month === bound.month && day === bound.day
      ? bound.hour
      : 23
  const hour = Math.min(rawHour, hourMax)

  const rawMinute = clamp(Number(dt?.minute) || 0, 0, 59)
  const minuteMax =
    year === bound.year &&
    month === bound.month &&
    day === bound.day &&
    hour === bound.hour
      ? bound.minute
      : 59
  const minute = Math.min(rawMinute, minuteMax)

  const rawSecond = clamp(Number(dt?.second) || 0, 0, 59)
  const secondMax =
    year === bound.year &&
    month === bound.month &&
    day === bound.day &&
    hour === bound.hour &&
    minute === bound.minute
      ? bound.second
      : 59
  const second = Math.min(rawSecond, secondMax)

  return { year, month, day, hour, minute, second }
}

function parseDateTimeValue(value, defaultTime) {
  if (!value) {
    return normalizeDraft(createFallbackDateTime(defaultTime))
  }
  const text = String(value).trim().replace("T", " ")
  const [dateText = "", timeText = defaultTime] = text.split(" ")
  const [yy, mm, dd] = dateText.split("-")
  const year = Number(yy)
  const month = Number(mm)
  const day = Number(dd)
  if ([year, month, day].some((v) => Number.isNaN(v))) {
    return normalizeDraft(createFallbackDateTime(defaultTime))
  }
  return normalizeDraft({ year, month, day, ...parseTimeParts(timeText) })
}

function createYearOptions(values, yearSpan, maxYear) {
  const upperYear = Number.isFinite(maxYear) ? maxYear : new Date().getFullYear()
  const fromValues = values
    .map((v) => {
      const t = String(v || "").trim()
      if (!t) return null
      const [d = ""] = t.replace("T", " ").split(" ")
      const y = Number(d.split("-")[0])
      return Number.isNaN(y) ? null : y
    })
    .filter((y) => y !== null && y <= upperYear)
  const minYear = Math.min(
    upperYear - yearSpan,
    ...(fromValues.length ? fromValues : [upperYear]),
  )
  return Array.from({ length: upperYear - minYear + 1 }, (_, i) =>
    String(minYear + i),
  )
}

function createDraftRange(startValue, endValue) {
  let start = parseDateTimeValue(startValue, props.defaultStartTime)
  let end = parseDateTimeValue(endValue, props.defaultEndTime)

  if (startValue && !endValue) {
    end = normalizeDraft({ ...start, ...parseTimeParts(props.defaultEndTime) })
  }
  if (!startValue && endValue) {
    start = normalizeDraft({ ...end, ...parseTimeParts(props.defaultStartTime) })
  }
  if (!startValue && !endValue) {
    end = normalizeDraft({ ...start, ...parseTimeParts(props.defaultEndTime) })
  }
  if (compareDateTime(end, start) < 0) end = { ...start }

  return { start, end }
}

function formatDateTimeText(value) {
  return value ? String(value).replace("T", " ") : ""
}

function formatDraftDateTime(dt) {
  return (
    `${dt.year}-${padNumber(dt.month)}-${padNumber(dt.day)} ` +
    `${padNumber(dt.hour)}:${padNumber(dt.minute)}:${padNumber(dt.second)}`
  )
}

// 生成 picker 六列的 items。这里是"未来值从源头消失"的唯一地方：按 prefix-equality
// 链条判断每一列的上界，凡是等于 now 的前缀，其下一列都只渲染 0..now[level]。
// 前缀一旦小于 now，下级列立即恢复到该字段的自然最大值（月 12、日 =当月天数、
// 时 23、分/秒 59），以支持用户把高位拉回过去时低位范围完全恢复。
function buildColumns(draft) {
  const now = nowRef.value
  // 防御性再归一化一次：保证 draft ≤ now，并防止 day 被月份跨越后越界。
  const safe = normalizeDraft(draft, now)

  const sameYear = safe.year === now.year
  const sameMonth = sameYear && safe.month === now.month
  const sameDay = sameMonth && safe.day === now.day
  const sameHour = sameDay && safe.hour === now.hour
  const sameMinute = sameHour && safe.minute === now.minute

  const monthMax = sameYear ? now.month : 12
  const daysInMonth = getDaysInMonth(safe.year, safe.month)
  const dayMax = sameMonth ? Math.min(now.day, daysInMonth) : daysInMonth
  const hourMax = sameDay ? now.hour : 23
  const minuteMax = sameHour ? now.minute : 59
  const secondMax = sameMinute ? now.second : 59

  const itemsByType = {
    year: yearOptions.value,
    month: createNumberOptions(1, monthMax),
    day: createNumberOptions(1, dayMax),
    hour: createNumberOptions(0, hourMax),
    minute: createNumberOptions(0, minuteMax),
    second: createNumberOptions(0, secondMax),
  }
  return COLUMN_TYPES.map((type) => ({
    type,
    suffix: COLUMN_SUFFIX[type],
    items: itemsByType[type],
  }))
}

function getTokenForType(dt, type) {
  switch (type) {
    case "year":
      return String(dt.year)
    case "month":
      return padNumber(dt.month)
    case "day":
      return padNumber(dt.day)
    case "hour":
      return padNumber(dt.hour)
    case "minute":
      return padNumber(dt.minute)
    default:
      return padNumber(dt.second)
  }
}

function buildPickerValueFromDraft(draft, columns) {
  const cols = columns || buildColumns(draft)
  return cols.map((col) => {
    const idx = col.items.indexOf(getTokenForType(draft, col.type))
    // 如果 draft 的某个字段已经被 normalizeDraft 收缩到列里最大项，indexOf 找不到
    // 时退到列末尾而不是 0，避免把日期意外回弹到月初 / 时分秒回弹到 0。
    if (idx >= 0) return idx
    return Math.max(col.items.length - 1, 0)
  })
}

function buildDraftFromSelection(selection, columns, fallback) {
  const safeIdx = (i) =>
    clamp(selection[i], 0, Math.max(columns[i].items.length - 1, 0))
  const year = Number(columns[0].items[safeIdx(0)]) || fallback.year
  const month = Number(columns[1].items[safeIdx(1)]) || fallback.month
  const day = Number(columns[2].items[safeIdx(2)]) || fallback.day
  const hour = Number(columns[3].items[safeIdx(3)])
  const minute = Number(columns[4].items[safeIdx(4)])
  const second = Number(columns[5].items[safeIdx(5)])
  // normalizeDraft 会在跨越 now-prefix 边界时再收紧一次 —— 比如用户本来停留在
  // 2025-07，月份列是 1-12；他把年拉到当年，normalizeDraft 把月压到 now.month。
  return normalizeDraft({
    year,
    month,
    day,
    hour: Number.isNaN(hour) ? fallback.hour : hour,
    minute: Number.isNaN(minute) ? fallback.minute : minute,
    second: Number.isNaN(second) ? fallback.second : second,
  })
}

function isSameSelection(a, b) {
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function syncStateFromProps(nextTab) {
  // 每次同步都刷新 nowRef —— 打开面板、外部 prop 变化、切面板都必经这里。
  nowRef.value = getNowDateTime()
  yearOptions.value = createYearOptions(
    [props.startValue, props.endValue],
    props.yearSpan,
    nowRef.value.year,
  )
  const range = createDraftRange(props.startValue, props.endValue)
  draftStart.value = range.start
  draftEnd.value = range.end
  activeTab.value = nextTab
  bumpSession()
}

function openPanel() {
  syncStateFromProps(normalizeField(props.field))
  panelVisible.value = true
  emit("open")
}

function closePanel(reason = "close") {
  panelVisible.value = false
  emit("close", reason)
}

function switchTab(tab) {
  const next = normalizeField(tab)
  if (next === activeTab.value) return
  activeTab.value = next
  bumpSession()
}

function onPickerChange(e) {
  const tab = activeTab.value
  const rawSelection = Array.isArray(e.detail?.value)
    ? e.detail.value.map((v) => Number(v) || 0)
    : []
  if (rawSelection.length !== 6) return

  const currentDraft = tab === "end" ? draftEnd.value : draftStart.value
  // 用 picker-view 正在渲染的列（= 改前 draft 对应的列）来解释 raw 索引，
  // 这样用户看到什么值我们就按什么值理解。
  const renderedColumns = buildColumns(currentDraft)
  const safeSelection = rawSelection.map((v, i) =>
    clamp(v, 0, Math.max(renderedColumns[i].items.length - 1, 0)),
  )

  // buildDraftFromSelection → normalizeDraft 会再次按 now 做 prefix 截断，所以
  // 即使用户的 raw 落点理论上未来（例如跨越零点后时钟已走过 now），这里也会
  // 被拉回合法值。
  const candidate = buildDraftFromSelection(
    safeSelection,
    renderedColumns,
    currentDraft,
  )

  let nextStart = tab === "start" ? candidate : draftStart.value
  let nextEnd = tab === "end" ? candidate : draftEnd.value

  // start ≤ end 约束：改 start 把 end 推上去；改 end 越过 start 则回弹到 start。
  if (compareDateTime(nextEnd, nextStart) < 0) {
    if (tab === "start") {
      nextEnd = { ...nextStart }
    } else {
      nextEnd = { ...nextStart }
    }
  }

  draftStart.value = nextStart
  draftEnd.value = nextEnd

  // 通过 activePickerValue 的 computed，picker-view 的 :value 自动重新计算；
  // 这里只需判断"用户原始落点 vs 最终选中项"是否一致，如果不一致说明我们改写
  // 了他的滚动结果 —— 必须 bumpSession 强制 picker-view 重挂以抹掉 snap。
  const finalActiveDraft = tab === "end" ? nextEnd : nextStart
  const finalActiveSelection = buildPickerValueFromDraft(finalActiveDraft)
  if (!isSameSelection(safeSelection, finalActiveSelection)) {
    bumpSession()
  }
}

function handleCancel() {
  emit("cancel")
  closePanel("cancel")
}

function handleConfirm() {
  const payload = {
    startValue: formatDraftDateTime(draftStart.value),
    endValue: formatDraftDateTime(draftEnd.value),
  }
  emit("update:startValue", payload.startValue)
  emit("update:endValue", payload.endValue)
  emit("change", payload)
  emit("confirm", payload)
  closePanel("confirm")
}

function bumpSession() {
  sessionVersion.value += 1
}
</script>

<style scoped>
.datetime-field {
  width: 100%;
  position: relative;
}

.datetime-field.is-open {
  z-index: 3200;
}

.datetime-trigger {
  width: 100%;
  min-height: 76rpx;
  padding: 0 20rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  background-color: #f9f9f9;
  color: #333;
  font-size: 30rpx;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.datetime-trigger.is-placeholder {
  color: #999;
}

.datetime-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.32);
  z-index: 3200;
}

.datetime-popup {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
  box-shadow: 0 -12rpx 48rpx rgba(15, 23, 42, 0.14);
  z-index: 3201;
  overflow: hidden;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.popup-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 20rpx;
}

.toolbar-action {
  font-size: 32rpx;
  line-height: 1.3;
  padding: 6rpx 4rpx;
}

.toolbar-action.cancel {
  color: #9aa0ab;
}

.toolbar-action.confirm {
  color: #2f7df6;
  font-weight: 600;
}

.toolbar-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
}

.popup-tabs {
  display: flex;
  align-items: stretch;
  padding: 8rpx 24rpx 0;
  border-bottom: 1rpx solid #eef1f6;
}

.popup-tab {
  flex: 1;
  position: relative;
  padding: 16rpx 12rpx 18rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
}

.popup-tab-label {
  font-size: 26rpx;
  color: #5b6472;
}

.popup-tab-value {
  font-size: 28rpx;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.popup-tab.is-active .popup-tab-label {
  color: #2f7df6;
  font-weight: 600;
}

.popup-tab.is-active .popup-tab-value {
  color: #1f2937;
  font-weight: 600;
}

.popup-tab.is-active::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 56rpx;
  height: 4rpx;
  border-radius: 999rpx;
  background: #2f7df6;
  transform: translateX(-50%);
}

.picker-view {
  width: 100%;
  height: 440rpx;
  margin-top: 8rpx;
  background: #fff;
}

/*
 * picker-view-column 的子节点必须是一个高度稳定、单层、纯 block 的 view，
 * 仅靠 line-height 决定高度。任何 flex / inline-block / 嵌套 text /
 * padding 都可能让 picker-view 在 H5 polyfill 下首屏测高出错，
 * 进而破坏 snap 行为，所以这里刻意保持极简。
 */
.picker-item {
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  font-size: 32rpx;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
</style>
