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

const MONTH_OPTIONS = createNumberOptions(1, 12)
const HOUR_OPTIONS = createNumberOptions(0, 23)
const MINUTE_OPTIONS = createNumberOptions(0, 59)
const SECOND_OPTIONS = createNumberOptions(0, 59)

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
const yearOptions = ref(createYearOptions([], props.yearSpan))
const draftStart = ref(createFallbackDateTime(props.defaultStartTime))
const draftEnd = ref(createFallbackDateTime(props.defaultEndTime))
const startPickerValue = ref([0, 0, 0, 0, 0, 0])
const endPickerValue = ref([0, 0, 0, 0, 0, 0])
// pickerViewKey 仅在「打开弹层 / 切换 tab / clamp 拽回」三种情况下 bump，
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

const activeColumns = computed(() => buildColumns(activeDraft.value))

const activePickerValue = computed(() =>
  activeTab.value === "end" ? endPickerValue.value : startPickerValue.value,
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
  return Array.from({ length: end - start + 1 }, (_, i) => padNumber(start + i))
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function createDayOptions(year, month) {
  return Array.from({ length: getDaysInMonth(year, month) }, (_, i) =>
    padNumber(i + 1),
  )
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

function normalizeDraft(dt) {
  const year = Number(dt.year) || new Date().getFullYear()
  const month = clamp(Number(dt.month) || 1, 1, 12)
  const maxDay = getDaysInMonth(year, month)
  const day = clamp(Number(dt.day) || 1, 1, maxDay)
  return {
    year,
    month,
    day,
    hour: clamp(Number(dt.hour) || 0, 0, 23),
    minute: clamp(Number(dt.minute) || 0, 0, 59),
    second: clamp(Number(dt.second) || 0, 0, 59),
  }
}

function clampToNow(dt) {
  const norm = normalizeDraft(dt)
  const now = getNowDateTime()
  return compareDateTime(norm, now) > 0 ? now : norm
}

function clampToYearRange(dt) {
  const years = yearOptions.value
  if (!years.length) return dt
  const minYear = Number(years[0])
  const maxYear = Number(years[years.length - 1])
  if (dt.year < minYear) return { ...dt, year: minYear }
  if (dt.year > maxYear) return { ...dt, year: maxYear }
  return dt
}

function parseDateTimeValue(value, defaultTime) {
  const fallback = createFallbackDateTime(defaultTime)
  if (!value) return fallback
  const text = String(value).trim().replace("T", " ")
  const [dateText = "", timeText = defaultTime] = text.split(" ")
  const [yy, mm, dd] = dateText.split("-")
  const year = Number(yy)
  const month = Number(mm)
  const day = Number(dd)
  if ([year, month, day].some((v) => Number.isNaN(v))) return fallback
  return clampToNow({ year, month, day, ...parseTimeParts(timeText) })
}

function createYearOptions(values, yearSpan) {
  const currentYear = new Date().getFullYear()
  const fromValues = values
    .map((v) => {
      const t = String(v || "").trim()
      if (!t) return null
      const [d = ""] = t.replace("T", " ").split(" ")
      const y = Number(d.split("-")[0])
      return Number.isNaN(y) ? null : y
    })
    .filter((y) => y !== null)
  const minYear = Math.min(
    currentYear - yearSpan,
    ...(fromValues.length ? fromValues : [currentYear]),
  )
  return Array.from({ length: currentYear - minYear + 1 }, (_, i) =>
    String(minYear + i),
  )
}

function createDraftRange(startValue, endValue) {
  let start = clampToNow(parseDateTimeValue(startValue, props.defaultStartTime))
  let end = clampToNow(parseDateTimeValue(endValue, props.defaultEndTime))

  if (startValue && !endValue) {
    end = clampToNow({ ...start, ...parseTimeParts(props.defaultEndTime) })
  }
  if (!startValue && endValue) {
    start = clampToNow({ ...end, ...parseTimeParts(props.defaultStartTime) })
  }
  if (!startValue && !endValue) {
    end = clampToNow({ ...start, ...parseTimeParts(props.defaultEndTime) })
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

function buildColumns(draft) {
  const safe = normalizeDraft(draft)
  const dayItems = createDayOptions(safe.year, safe.month)
  const map = {
    year: yearOptions.value,
    month: MONTH_OPTIONS,
    day: dayItems,
    hour: HOUR_OPTIONS,
    minute: MINUTE_OPTIONS,
    second: SECOND_OPTIONS,
  }
  return COLUMN_TYPES.map((type) => ({
    type,
    suffix: COLUMN_SUFFIX[type],
    items: map[type],
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

function buildPickerValueFromDraft(draft) {
  const columns = buildColumns(draft)
  return columns.map((col) => {
    const idx = col.items.indexOf(getTokenForType(draft, col.type))
    return Math.max(0, idx)
  })
}

function buildDraftFromSelection(selection, columns, fallback) {
  const year = Number(columns[0].items[selection[0]]) || fallback.year
  const month = Number(columns[1].items[selection[1]]) || fallback.month
  // 日列要按"新的 year/month"重新算最大值，再 clamp 用户原始 day 索引
  const dayItems = createDayOptions(year, month)
  const safeDayIndex = clamp(selection[2], 0, Math.max(dayItems.length - 1, 0))
  const day = Number(dayItems[safeDayIndex]) || fallback.day
  const hour = Number(columns[3].items[selection[3]])
  const minute = Number(columns[4].items[selection[4]])
  const second = Number(columns[5].items[selection[5]])
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
  for (let i = 0; i < 6; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function syncStateFromProps(nextTab) {
  yearOptions.value = createYearOptions(
    [props.startValue, props.endValue],
    props.yearSpan,
  )
  const range = createDraftRange(props.startValue, props.endValue)
  draftStart.value = range.start
  draftEnd.value = range.end
  startPickerValue.value = buildPickerValueFromDraft(range.start)
  endPickerValue.value = buildPickerValueFromDraft(range.end)
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
  const columns = buildColumns(currentDraft)
  const safeSelection = rawSelection.map((v, i) =>
    clamp(v, 0, Math.max(columns[i].items.length - 1, 0)),
  )

  const candidate = buildDraftFromSelection(safeSelection, columns, currentDraft)
  const adjusted = clampToNow(clampToYearRange(candidate))

  let nextStart = tab === "start" ? adjusted : draftStart.value
  let nextEnd = tab === "end" ? adjusted : draftEnd.value

  // 强制 end >= start
  if (compareDateTime(nextEnd, nextStart) < 0) {
    if (tab === "start") {
      nextEnd = { ...nextStart }
    } else {
      nextEnd = { ...nextStart }
    }
  }

  draftStart.value = nextStart
  draftEnd.value = nextEnd

  const nextStartSelection = buildPickerValueFromDraft(nextStart)
  const nextEndSelection = buildPickerValueFromDraft(nextEnd)

  if (!isSameSelection(startPickerValue.value, nextStartSelection)) {
    startPickerValue.value = nextStartSelection
  }
  if (!isSameSelection(endPickerValue.value, nextEndSelection)) {
    endPickerValue.value = nextEndSelection
  }

  // 仅当用户实际落点 ≠ 我们最终采纳的合法落点（被未来时间 / 年范围 /
  // end>=start 校正回来）才强制重挂 picker-view，其它情况让 picker-view
  // 自己完成原生 snap 动画。
  const activeAfter = tab === "end" ? nextEndSelection : nextStartSelection
  if (!isSameSelection(safeSelection, activeAfter)) {
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
