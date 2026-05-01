# 历史数据页功能执行流程

本文档基于当前 `src/pages/behavior/HistoryData.vue` 说明历史数据页完整执行流程；`src/pages/sensor/HistoryData.vue` 基本同构，只是：

- `type = "sensor"` / `"behavior"`
- WebSocket topic 是 `sensor_update` / `behavior_update`
- 导航目标不同

## 1. 页面整体职责

历史数据页主要有 4 条功能链路：

1. 页面进入初始化
   - 拉取当前页表格数据
   - 根据当前页表格数据生成“当前页明细”图表
   - 订阅 WebSocket 更新

2. 筛选查询
   - 设备编号、开始时间、结束时间变更
   - 点击查询后重新拉表格
   - 如果当前是趋势总览，再拉趋势图

3. 分页和每页条数
   - 翻页或修改 pageSize
   - 重新拉当前页表格
   - 当前页明细图表同步更新

4. 图表功能
   - 当前页明细：由表格当前页数据直接生成
   - 趋势总览：调用图表接口获取全范围聚合数据
   - 折线图 / 柱状图切换：只转换已有图表 series，不重新请求接口

## 2. 页面初始化执行流程

入口在：

```js
onMounted(async () => { ... })
```

位置：`src/pages/behavior/HistoryData.vue:322`

当前初始化流程：

```text
页面进入
  ↓
onMounted()
  ↓
fetchData()
  ↓
buildTableQueryParams()
  ↓
getFormatPaged()
  ↓
normalizeTableResponse()
  ↓
applyTableResponse()
  ↓
如果 chartDataMode === "page"
  ↓
updateChartFromCurrentPage()
  ↓
buildChartDataFromTableData()
  ↓
normalizeChartSeries()
  ↓
createValueAxisConfig()
  ↓
更新 chartCategories / chartSeries / chartYAxis
  ↓
UChartCanvas 自动重绘
  ↓
注册 wsClient.on("behavior_update", handleWsData)
  ↓
发送 subscribe behavior_update
```

对应代码：

- `chartDataMode = ref("page")`：`src/pages/behavior/HistoryData.vue:252`
- `onMounted()`：`src/pages/behavior/HistoryData.vue:322`
- `fetchData()`：`src/pages/behavior/HistoryData.vue:387`
- `updateChartFromCurrentPage()`：`src/pages/behavior/HistoryData.vue:724`
- WebSocket 订阅：`src/pages/behavior/HistoryData.vue:336`

### 2.1 初始化链路中每个函数的职责

| 函数 / 步骤 | 作用 |
| --- | --- |
| `onMounted()` | 页面初始化入口。先拉当前页表格数据；如果当前是趋势总览模式，再拉趋势图；最后注册并订阅 WebSocket 更新。 |
| `fetchData()` | 表格数据主入口。负责发起当前页分页请求，并把响应交给标准化和应用函数处理。 |
| `buildTableQueryParams()` | 汇总当前页码、每页条数、设备号、起止时间和业务类型，生成表格分页接口参数。 |
| `getFormatPaged()` | 调用后端分页数据接口，获取当前筛选条件下的表格行、总数等数据。 |
| `normalizeTableResponse()` | 标准化分页接口返回值，把后端响应整理成 `rows`、`headers`、`total` 三部分。 |
| `applyTableResponse()` | 把标准化后的表格数据写入页面状态；如果当前是当前页明细模式，会同步触发图表重建。 |
| `updateChartFromCurrentPage()` | 当前页明细图表入口。不请求图表接口，直接把当前页表格数据转换成图表数据。 |
| `buildChartDataFromTableData()` | 从当前页表格行中提取时间轴和数值字段，生成图表需要的 `categories` 和 `series`。 |
| `normalizeChartSeries()` | 把页面生成的原始 series 调整成 uCharts 当前图表类型需要的数据结构。 |
| `createValueAxisConfig()` | 根据图表 series 生成 Y 轴配置，例如最小值、最大值、分隔数量等。 |
| 更新 `chartCategories / chartSeries / chartYAxis` | 将图表数据写入响应式状态，传递给 `UChartCanvas`。 |
| `UChartCanvas` 自动重绘 | 子组件监听图表 props 变化，收到新的 categories/series/yAxis 后自动重新绘制。 |
| `wsClient.on("behavior_update", handleWsData)` | 注册 WebSocket 回调，后续收到行为数据更新时进入 `handleWsData()`。 |
| `wsClient.send({ type: "subscribe", topics: ["behavior_update"] })` | 告诉后端当前页面要订阅 `behavior_update` topic，只有订阅后才会收到对应实时推送。 |

### 2.2 为什么现在进入页面不会立刻拉趋势图？

因为默认：

```js
const chartDataMode = ref("page")
```

位置：`src/pages/behavior/HistoryData.vue:252`

所以 `onMounted()` 里的这段不会执行：

```js
if (chartDataMode.value === "range") {
  await fetchChartData()
}
```

位置：`src/pages/behavior/HistoryData.vue:325`

也就是说，首屏只走：

```text
fetchData()
  ↓
当前页明细图表
```

不会立即调用趋势图接口 `getFormatChart()`。

## 3. 表格数据请求流程

主函数：

```js
async function fetchData()
```

位置：`src/pages/behavior/HistoryData.vue:387`

完整调用链：

```text
fetchData()
  ↓
buildTableQueryParams()
  ↓
buildDateTimeParam(startDate, startTime, false)
  ↓
buildDateTimeText()
  ↓
normalizeTimeText()

buildDateTimeParam(endDate, endTime, true)
  ↓
buildDateTimeText()
  ↓
normalizeTimeText()

  ↓
getFormatPaged(
  page,
  pageSize,
  dNo,
  startTime,
  endTime,
  type
)
  ↓
normalizeTableResponse(res)
  ↓
applyTableResponse(result)
  ↓
如果 chartDataMode === "page"
  ↓
updateChartFromCurrentPage()
```

### 3.1 `buildTableQueryParams()`

位置：`src/pages/behavior/HistoryData.vue:349`

作用：把页面状态组装成表格接口参数。

读取这些状态：

```js
currentPage.value
pageSize.value
d_no.value
startDate.value
startTime.value
endDate.value
endTime.value
type.value
```

返回：

```js
{
  page,
  pageSize,
  dNo,
  startTime,
  endTime,
  type
}
```

调用位置：

```js
const params = buildTableQueryParams()
```

位置：`src/pages/behavior/HistoryData.vue:389`

### 3.2 `buildDateTimeParam()`

位置：`src/pages/behavior/HistoryData.vue:591`

作用：给接口生成时间字符串。

它本身只是转调：

```js
return buildDateTimeText(date, time, isEnd)
```

调用链：

```text
buildTableQueryParams()
  ↓
buildDateTimeParam()
  ↓
buildDateTimeText()
  ↓
normalizeTimeText()
```

### 3.3 `buildDateTimeText()`

位置：`src/pages/behavior/HistoryData.vue:585`

作用：把分开的日期和时间合成接口需要的 datetime 字符串。

例如：

```js
date = "2026-04-26"
time = "12:30:00"
```

返回：

```js
"2026-04-26 12:30:00"
```

如果 date 为空，返回空字符串：

```js
if (!date) return ""
```

这表示接口不传该方向的时间限制。

### 3.4 `normalizeTimeText()`

位置：`src/pages/behavior/HistoryData.vue:595`

作用：把时间修正成安全的 `HH:mm:ss`。

例如：

```js
"8:3"
```

会补成：

```js
"08:03:00"
```

它还会限制：

- 小时：`0 ~ 23`
- 分钟：`0 ~ 59`
- 秒：`0 ~ 59`

用途：

- 查询接口组装时间
- WebSocket 判断时间范围
- 日期选择器回填时间

### 3.5 `normalizeTableResponse(res)`

位置：`src/pages/behavior/HistoryData.vue:360`

作用：把后端分页接口结果整理成页面可用结构。

输入：`getFormatPaged()` 返回结果。

处理：

```text
res.data.data
  ↓
如果是数组，作为 rows
否则 rows = []

rows[0]
  ↓
生成 tableHeader
```

返回：

```js
{
  rows,
  headers,
  total
}
```

其中 `headers` 来自后端返回的字段：

```js
{
  prop: field.f_name,
  label: field.unit ? `${field.f_name}(${field.unit})` : field.f_name
}
```

所以表头不是前端写死的，而是根据后端字段动态生成。

### 3.6 `applyTableResponse(result)`

位置：`src/pages/behavior/HistoryData.vue:376`

作用：把标准化后的表格结果写入页面状态。

执行：

```text
tableData.value = result.rows
tableHeader.value = result.headers
total.value = result.total
```

然后判断当前图表模式：

```js
if (chartDataMode.value === "page") {
  updateChartFromCurrentPage()
}
```

也就是说：

- 当前页明细模式：表格更新后立刻重建图表
- 趋势总览模式：表格更新后不直接改图表，趋势图由 `fetchChartData()` 管

## 4. 当前页明细图表流程

当前页明细不请求图表接口。

主函数：

```js
updateChartFromCurrentPage()
```

位置：`src/pages/behavior/HistoryData.vue:724`

调用来源：

1. 表格请求完成后：
   - `applyTableResponse()`：`src/pages/behavior/HistoryData.vue:381`

2. 切换图表模式到当前页明细：
   - `onChartModeChange()`：`src/pages/behavior/HistoryData.vue:714`

完整流程：

```text
updateChartFromCurrentPage()
  ↓
clearScheduledChartRefresh()
  ↓
chartRequestId += 1
  ↓
buildChartDataFromTableData(tableData.value)
  ↓
findFieldByName()
  ↓
toChartNumber()
  ↓
normalizeChartSeries()
  ↓
createValueAxisConfig()
  ↓
更新 chartCategories / chartSeries / chartYAxis
  ↓
UChartCanvas 重绘
```

### 4.1 `clearScheduledChartRefresh()`

位置：`src/pages/behavior/HistoryData.vue:501`

作用：取消已经排队的趋势图 WebSocket 延迟刷新。

为什么当前页明细要调用它？

因为当前页明细不需要趋势图接口。如果之前在趋势总览模式下排了一个延迟刷新，切回当前页明细后必须取消，否则之后可能会误拉趋势图。

执行：

```js
if (wsRefreshTimer) {
  clearTimeout(wsRefreshTimer)
  wsRefreshTimer = null
}
hasPendingChartRefresh = false
```

### 4.2 为什么 `chartRequestId += 1`？

位置：`src/pages/behavior/HistoryData.vue:726`

作用：让之前还没返回的趋势图请求失效。

场景：

```text
用户在趋势总览模式
  ↓
fetchChartData() 发出请求，requestId = 1
  ↓
请求还没回来
  ↓
用户切换到当前页明细
  ↓
chartRequestId += 1，变成 2
  ↓
旧请求回来
  ↓
applyChartResponse(result, 1)
  ↓
发现 1 !== chartRequestId
  ↓
旧结果丢弃
```

这样可以避免旧趋势图数据覆盖当前页明细图表。

### 4.3 `buildChartDataFromTableData(rows)`

位置：`src/pages/behavior/HistoryData.vue:739`

作用：把当前页表格数据转成图表数据。

流程：

```text
tableData 当前页数据
  ↓
orderedRows = [...rows].reverse()
  ↓
用“更新时间”生成 categories
  ↓
遍历每一行每个字段
  ↓
排除：
  - 设备编号
  - 是否在线数据
  - 更新时间
  ↓
只保留能转成数字的字段
  ↓
生成 series
```

为什么要 `reverse()`？

通常表格是按时间倒序展示，最新数据在前。图表更适合从旧到新展示，所以反转成时间正序。

### 4.4 `findFieldByName(row, name)`

位置：`src/pages/behavior/HistoryData.vue:779`

作用：从一行数据里找到指定中文字段名。

例如：

```js
findFieldByName(row, "更新时间")
```

返回这一项 field。

这个函数被这些地方调用：

- 当前页图表生成：`buildChartDataFromTableData()`
- 趋势图追加最新点：`appendLatestTablePointToRangeChart()`

## 5. 趋势总览图表流程

趋势总览主函数：

```js
fetchChartData()
```

位置：`src/pages/behavior/HistoryData.vue:467`

调用来源：

1. 页面初始化时，如果默认是 `range`
   - 现在默认不是，所以首屏不会调用

2. 用户切换到趋势总览：
   - `onChartModeChange()`：`src/pages/behavior/HistoryData.vue:719`

3. 用户在趋势总览模式点击查询：
   - `onFilter()`：`src/pages/behavior/HistoryData.vue:671`

4. 用户在趋势总览模式点击重置：
   - `onReset()`：`src/pages/behavior/HistoryData.vue:685`

5. WebSocket 延迟节流刷新：
   - `scheduleChartRefresh()`：`src/pages/behavior/HistoryData.vue:549`

完整调用链：

```text
fetchChartData()
  ↓
如果 chartDataMode !== "range"
  ↓
直接 return

如果 isChartFetching === true
  ↓
hasPendingChartRefresh = true
  ↓
return

否则：
  ↓
isChartFetching = true
requestId = ++chartRequestId
lastChartFetchAt = Date.now()
  ↓
buildChartQueryParams()
  ↓
getFormatChart()
  ↓
normalizeChartResponse(res)
  ↓
alignChartDataToCategories()
  ↓
downsampleChartData()
  ↓
normalizeChartSeries()
  ↓
createValueAxisConfig()
  ↓
applyChartResponse(result, requestId)
  ↓
appendLatestTablePointToRangeChart()
  ↓
finally:
  isChartFetching = false
  如果 hasPendingChartRefresh
    ↓
    scheduleChartRefresh()
```

### 5.1 `buildChartQueryParams()`

位置：`src/pages/behavior/HistoryData.vue:408`

作用：组装趋势图接口参数。

和表格查询参数类似，但没有分页参数：

```js
{
  dNo,
  startTime,
  endTime,
  type
}
```

调用位置：

```js
const params = buildChartQueryParams()
```

位置：`src/pages/behavior/HistoryData.vue:478`

### 5.2 `fetchChartData()` 的并发保护

位置：`src/pages/behavior/HistoryData.vue:467`

关键逻辑：

```js
if (isChartFetching) {
  hasPendingChartRefresh = true
  return
}
```

作用：

如果趋势图接口正在请求中，又来了新的刷新需求，不会再并发发一个新请求，而是记一笔：

```js
hasPendingChartRefresh = true
```

等当前请求结束后，在 `finally` 里处理：

```js
if (hasPendingChartRefresh) {
  hasPendingChartRefresh = false
  scheduleChartRefresh()
}
```

这样可以避免趋势图接口并发堆积。

### 5.3 `normalizeChartResponse(res)`

位置：`src/pages/behavior/HistoryData.vue:422`

作用：把趋势图接口数据整理成 `UChartCanvas` 能吃的数据。

流程：

```text
res.data.data
  ↓
取 times, series
  ↓
如果 times 为空
  ↓
返回空图表结构

否则：
  ↓
alignChartDataToCategories(times, series)
  ↓
downsampleChartData()
  ↓
normalizeChartSeries()
  ↓
createValueAxisConfig()
  ↓
返回：
  {
    categories,
    series,
    yAxis
  }
```

里面调用的工具函数来自：

```js
src/utils/ucharts.js
```

### 5.4 `getChartMaxPoints()`

位置：`src/pages/behavior/HistoryData.vue:417`

作用：根据屏幕宽度决定趋势图最大点数。

```js
const screenWidth = uni.getSystemInfoSync().windowWidth || 375
return screenWidth >= 1024 ? MAX_CHART_POINTS_DESKTOP : MAX_CHART_POINTS_MOBILE
```

当前配置：

```js
MAX_CHART_POINTS_MOBILE = 120
MAX_CHART_POINTS_DESKTOP = 200
```

位置：`src/pages/behavior/HistoryData.vue:273`

作用是控制趋势图点数，避免一次画太多点。

### 5.5 `applyChartResponse(result, requestId)`

位置：`src/pages/behavior/HistoryData.vue:456`

作用：把趋势图结果写入页面状态。

第一步先判断请求是否还有效：

```js
if (requestId !== chartRequestId || chartDataMode.value !== "range") return
```

意思是：

- 如果这不是最新请求，丢弃
- 如果用户已经不在趋势总览模式，丢弃

通过后才写入：

```js
chartCategories.value = result.categories
chartSeries.value = result.series
chartYAxis.value = result.yAxis
```

然后调用：

```js
appendLatestTablePointToRangeChart()
```

### 5.6 `appendLatestTablePointToRangeChart()`

位置：`src/pages/behavior/HistoryData.vue:784`

作用：趋势图请求返回后，尝试把当前表格最新一条数据补到趋势图末尾。

为什么需要它？

趋势图接口一般按分钟聚合，可能比表格当前最新数据略慢。这个函数用当前表格第一行数据补一个最新点，让趋势图更接近实时。

执行流程：

```text
appendLatestTablePointToRangeChart()
  ↓
latestRow = tableData.value[0]
  ↓
如果不是 range 模式，return
如果 latestRow 不是数组，return
如果 chartCategories / chartSeries 为空，return
  ↓
从 latestRow 里找“更新时间”
  ↓
getChartMinuteText()
  ↓
如果时间为空，return
如果这个时间已经在 chartCategories 里，return
  ↓
遍历 chartSeries
  ↓
按 series.name 找 latestRow 对应字段
  ↓
toChartNumber(field.value)
  ↓
追加到 series.data 后面
  ↓
chartCategories 追加 timeText
  ↓
重新 createValueAxisConfig()
```

### 5.7 `getChartMinuteText(value)`

位置：`src/pages/behavior/HistoryData.vue:810`

作用：把时间裁剪到分钟级。

例如：

```js
"2026-04-26 12:34:56"
```

返回：

```js
"2026-04-26 12:34"
```

因为趋势图接口按分钟聚合，所以追加点也要对齐分钟粒度。

## 6. WebSocket 实时刷新流程

WebSocket 入口：

```js
const handleWsData = (data) => { ... }
```

位置：`src/pages/behavior/HistoryData.vue:315`

注册位置：

```js
wsClient.on("behavior_update", handleWsData)
```

位置：`src/pages/behavior/HistoryData.vue:336`

订阅位置：

```js
wsClient.send({
  type: "subscribe",
  topics: ["behavior_update"],
})
```

位置：`src/pages/behavior/HistoryData.vue:337`

完整流程：

```text
后端推送 behavior_update
  ↓
wsClient 触发 handleWsData(data)
  ↓
shouldRefreshChartFromWs(data)
  ↓
如果不命中当前筛选，return
  ↓
scheduleHistoryRefresh()
  ↓
clearScheduledHistoryRefresh()
  ↓
setTimeout 400ms
  ↓
fetchData()
  ↓
如果当前是 page 模式：
    fetchData() 内部 updateChartFromCurrentPage()
  ↓
如果当前是 range 模式：
    scheduleChartRefresh()
      ↓
      按 10 秒节流
      ↓
      fetchChartData()
```

### 6.1 `handleWsData(data)`

位置：`src/pages/behavior/HistoryData.vue:315`

作用：WebSocket 推送入口。

它自己不直接刷新表格，也不直接刷新图表。

它只做：

```js
if (shouldRefreshChartFromWs(data)) {
  scheduleHistoryRefresh()
}
```

这样做是为了先判断推送数据是否和当前筛选条件相关。

### 6.2 `shouldRefreshChartFromWs(data)`

位置：`src/pages/behavior/HistoryData.vue:516`

作用：判断这条 WebSocket 推送是否需要刷新当前页面。

流程：

```text
shouldRefreshChartFromWs(data)
  ↓
如果开启设备功能，并且用户筛了设备号
  ↓
判断 data.d_no 是否等于当前 d_no
  ↓
不等则 return false

如果没有 data.timestamp
  ↓
return false

解析推送时间：
  ↓
dataTime = new Date(data.timestamp)

解析筛选开始时间：
  ↓
parseDateTime(startDate, startTime, false)

解析筛选结束时间：
  ↓
parseDateTime(endDate, endTime, true)

最后判断：
  ↓
dataTime >= start
dataTime <= end
```

关键逻辑：

```js
return (!start || dataTime >= start) && (!end || dataTime <= end)
```

含义：

- 没有开始时间：不限制开始边界
- 没有结束时间：不限制结束边界
- 两个都有：必须落在区间内

### 6.3 `parseDateTime(date, time, isEnd)`

位置：`src/pages/behavior/HistoryData.vue:646`

作用：把页面里的日期、时间转换成 `Date` 对象，给 WebSocket 时间范围判断用。

调用来源：

```js
shouldRefreshChartFromWs()
```

位置：

- 开始时间：`src/pages/behavior/HistoryData.vue:531`
- 结束时间：`src/pages/behavior/HistoryData.vue:532`

调用链：

```text
shouldRefreshChartFromWs()
  ↓
parseDateTime()
  ↓
normalizeTimeText()
  ↓
new Date(...)
```

### 6.4 `scheduleHistoryRefresh()`

位置：`src/pages/behavior/HistoryData.vue:553`

作用：WebSocket 推送后，延迟合并刷新历史页。

流程：

```text
scheduleHistoryRefresh()
  ↓
clearScheduledHistoryRefresh()
  ↓
setTimeout 400ms
  ↓
fetchData()
  ↓
如果当前 chartDataMode === "range"
    ↓
    scheduleChartRefresh()
```

为什么要先 `clearScheduledHistoryRefresh()`？

如果短时间内来了很多 WebSocket 推送：

```text
第 1 条推送
  ↓
设置一个 400ms 后刷新

第 2 条推送
  ↓
取消前一个 timer
  ↓
重新设置 400ms

第 3 条推送
  ↓
继续取消并重设
```

最终只刷新一次，避免频繁请求。

### 6.5 `scheduleChartRefresh()`

位置：`src/pages/behavior/HistoryData.vue:536`

作用：趋势总览模式下，WebSocket 被动触发的图表刷新要节流。

流程：

```text
scheduleChartRefresh()
  ↓
如果当前不是 range 模式，return
  ↓
elapsed = Date.now() - lastChartFetchAt
  ↓
delay = Math.max(500, CHART_REFRESH_INTERVAL - elapsed)
  ↓
clearScheduledChartRefresh()
  ↓
setTimeout(delay)
  ↓
如果 isChartFetching
    hasPendingChartRefresh = true
    return
  ↓
fetchChartData()
```

当前趋势图刷新间隔：

```js
CHART_REFRESH_INTERVAL = 10000
```

位置：`src/pages/behavior/HistoryData.vue:271`

也就是说，WebSocket 推送再频繁，趋势图接口也不会被每 400ms 直接刷新。

## 7. 筛选查询流程

模板入口：

```vue
<button class="query-btn" @click="onFilter">查询</button>
```

位置：`src/pages/behavior/HistoryData.vue:64`

主函数：

```js
async function onFilter()
```

位置：`src/pages/behavior/HistoryData.vue:665`

完整流程：

```text
点击查询
  ↓
onFilter()
  ↓
如果 showDeviceFeatures 关闭
  ↓
d_no.value = ""
  ↓
currentPage.value = 1
  ↓
fetchData()
  ↓
如果当前是 page 模式
    ↓
    fetchData() 内部 updateChartFromCurrentPage()

  ↓
如果当前是 range 模式
    ↓
    clearScheduledChartRefresh()
    ↓
    fetchChartData()
```

也就是说：

- 当前页明细模式：查询只拉分页接口
- 趋势总览模式：查询拉分页接口 + 趋势图接口

## 8. 重置流程

模板入口：

```vue
<button class="reset-btn" @click="onReset">重置</button>
```

位置：`src/pages/behavior/HistoryData.vue:65`

主函数：

```js
async function onReset()
```

位置：`src/pages/behavior/HistoryData.vue:677`

完整流程：

```text
点击重置
  ↓
onReset()
  ↓
d_no = ""
startDate = ""
startTime = "00:00:00"
endDate = ""
endTime = "23:59:59"
currentPage = 1
  ↓
fetchData()
  ↓
如果当前是 page 模式
    ↓
    updateChartFromCurrentPage()

  ↓
如果当前是 range 模式
    ↓
    clearScheduledChartRefresh()
    ↓
    fetchChartData()
```

## 9. 设备编号输入流程

模板入口：

```vue
<input
  :value="d_no"
  @input="onDeviceInput"
  @confirm="onFilter"
/>
```

位置：

- 输入：`src/pages/behavior/HistoryData.vue:30`
- 回车确认查询：`src/pages/behavior/HistoryData.vue:31`

调用流程：

```text
用户输入设备编号
  ↓
onDeviceInput(e)
  ↓
readEventValue(e)
  ↓
d_no.value = 输入值
```

函数位置：

- `onDeviceInput()`：`src/pages/behavior/HistoryData.vue:572`
- `readEventValue()`：`src/pages/behavior/HistoryData.vue:566`

如果用户按确认键：

```text
@confirm
  ↓
onFilter()
```

### 9.1 `readEventValue(e)`

位置：`src/pages/behavior/HistoryData.vue:566`

作用：兼容不同平台事件结构。

它会依次尝试：

```js
e.detail.value
e.target.value
```

如果都没有，返回空字符串。

这个函数被多个事件复用：

- 设备输入
- 图表类型 picker
- 图表模式 picker

## 10. 日期时间选择流程

模板入口：

```vue
<DateTimePickerField
  @update:startValue="onStartDateTimeChange"
  @update:endValue="onEndDateTimeChange"
/>
```

位置：

- 开始时间组件：`src/pages/behavior/HistoryData.vue:37`
- 结束时间组件：`src/pages/behavior/HistoryData.vue:51`

调用流程：

```text
用户选择开始时间
  ↓
onStartDateTimeChange(value)
  ↓
applyDateTimeValue("start", value)
  ↓
normalizeTimeText()
  ↓
更新 startDate / startTime
```

```text
用户选择结束时间
  ↓
onEndDateTimeChange(value)
  ↓
applyDateTimeValue("end", value)
  ↓
normalizeTimeText()
  ↓
更新 endDate / endTime
```

函数位置：

- `onStartDateTimeChange()`：`src/pages/behavior/HistoryData.vue:576`
- `onEndDateTimeChange()`：`src/pages/behavior/HistoryData.vue:580`
- `applyDateTimeValue()`：`src/pages/behavior/HistoryData.vue:615`

### 10.1 `applyDateTimeValue(kind, rawValue)`

位置：`src/pages/behavior/HistoryData.vue:615`

作用：把日期时间组件给出的字符串拆成日期和时间两部分。

输入示例：

```js
"2026-04-26 12:30:00"
```

处理流程：

```text
rawValue
  ↓
trim()
  ↓
如果为空：
    start -> startDate="", startTime="00:00:00"
    end   -> endDate="", endTime="23:59:59"
  ↓
不为空：
    把空格替换成 T
    split("T")
  ↓
dateText, timeText
  ↓
normalizeTimeText()
  ↓
写入 startDate/startTime 或 endDate/endTime
```

## 11. 分页流程

### 11.1 上一页

模板入口：

```vue
<button @click="prevPage">‹</button>
```

位置：`src/pages/behavior/HistoryData.vue:152`

函数：

```js
function prevPage()
```

位置：`src/pages/behavior/HistoryData.vue:817`

流程：

```text
点击上一页
  ↓
prevPage()
  ↓
如果 currentPage > 1
  ↓
currentPage--
  ↓
fetchData()
  ↓
如果 page 模式，自动 updateChartFromCurrentPage()
```

### 11.2 下一页

模板入口：

```vue
<button @click="nextPage">›</button>
```

位置：`src/pages/behavior/HistoryData.vue:160`

函数：

```js
function nextPage()
```

位置：`src/pages/behavior/HistoryData.vue:824`

流程：

```text
点击下一页
  ↓
nextPage()
  ↓
如果 currentPage < totalPages
  ↓
currentPage++
  ↓
fetchData()
  ↓
如果 page 模式，自动 updateChartFromCurrentPage()
```

### 11.3 每页条数变化

模板入口：

```vue
<picker
  :range="pageSizes"
  :value="pageSizeIndex"
  @change="onPageSizeChange"
/>
```

位置：`src/pages/behavior/HistoryData.vue:164`

函数：

```js
function onPageSizeChange(e)
```

位置：`src/pages/behavior/HistoryData.vue:691`

流程：

```text
用户选择每页条数
  ↓
onPageSizeChange(e)
  ↓
pageSizeIndex.value = e.detail.value
  ↓
pageSize.value = pageSizes[e.detail.value]
  ↓
currentPage.value = 1
  ↓
fetchData()
```

## 12. 图表模式切换流程

模板入口：

```vue
<picker
  :range="chartModeOptions"
  :value="chartModeIndex"
  @change="onChartModeChange"
/>
```

位置：`src/pages/behavior/HistoryData.vue:182`

函数：

```js
function onChartModeChange(e)
```

位置：`src/pages/behavior/HistoryData.vue:709`

当前模式：

```js
chartModeOptions = [
  { label: "趋势总览", value: "range" },
  { label: "当前页明细", value: "page" },
]
```

位置：`src/pages/behavior/HistoryData.vue:253`

完整流程：

```text
用户切换图表模式
  ↓
onChartModeChange(e)
  ↓
readEventValue(e)
  ↓
nextMode = chartModeOptions[index]?.value || "range"
  ↓
chartDataMode.value = nextMode
```

如果切到当前页明细：

```text
nextMode === "page"
  ↓
updateChartFromCurrentPage()
  ↓
return
```

如果切到趋势总览：

```text
nextMode === "range"
  ↓
clearScheduledChartRefresh()
  ↓
lastChartFetchAt = 0
  ↓
fetchChartData()
```

## 13. 图表类型切换流程

模板入口：

```vue
<picker
  :range="chartTypes"
  :value="chartTypeIndex"
  @change="onChartTypeChange"
/>
```

位置：`src/pages/behavior/HistoryData.vue:195`

函数：

```js
function onChartTypeChange(e)
```

位置：`src/pages/behavior/HistoryData.vue:698`

图表类型：

```js
chartTypes = [
  { label: "折线图", value: "line" },
  { label: "柱状图", value: "bar" },
]
```

位置：`src/pages/behavior/HistoryData.vue:258`

流程：

```text
用户切换折线图/柱状图
  ↓
onChartTypeChange(e)
  ↓
readEventValue(e)
  ↓
chartTypeIndex.value = index
  ↓
normalizeChartSeries(chartSeries.value, currentChartType.value)
  ↓
更新 chartSeries
  ↓
UChartCanvas 根据 props 自动重绘
```

注意：这里不会重新请求接口，只是把当前已有 `chartSeries` 转换成当前图表类型需要的结构。

## 14. 导航流程

模板入口：

```vue
@click="navigateTo('/pages/behavior/RealtimeData')"
```

位置：`src/pages/behavior/HistoryData.vue:6`

函数：

```js
function navigateTo(url)
```

位置：`src/pages/behavior/HistoryData.vue:831`

流程：

```text
点击实时数据菜单
  ↓
navigateTo(url)
  ↓
navigateToPage(url)
```

`navigateToPage()` 来自：

```js
src/utils/navigation.js
```

它会判断目标页面是不是 tabBar 页面：

- tabBar 页面：`uni.switchTab`
- 非 tabBar 页面：`uni.navigateTo`

## 15. 页面卸载流程

入口：

```js
onUnmounted(() => { ... })
```

位置：`src/pages/behavior/HistoryData.vue:343`

流程：

```text
离开历史页
  ↓
onUnmounted()
  ↓
wsClient.off("behavior_update", handleWsData)
  ↓
clearScheduledChartRefresh()
  ↓
clearScheduledHistoryRefresh()
```

作用：

1. 取消 WebSocket 回调，避免页面销毁后还处理推送。
2. 清掉趋势图延迟刷新 timer。
3. 清掉历史表格延迟刷新 timer。

## 16. 计算属性执行流程

计算属性不是手动调用，而是 Vue 根据依赖自动重新计算。

### 16.1 `totalPages`

位置：`src/pages/behavior/HistoryData.vue:282`

```js
const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)
```

依赖：

- `total.value`
- `pageSize.value`

触发场景：

- 表格请求完成后 `total` 更新
- 用户修改每页条数

用于模板：

```vue
{{ currentPage }} / {{ totalPages }}
```

位置：`src/pages/behavior/HistoryData.vue:156`

### 16.2 `chartModeIndex`

位置：`src/pages/behavior/HistoryData.vue:283`

作用：把当前模式值转成 picker 需要的 index。

依赖：

- `chartDataMode.value`
- `chartModeOptions`

用于模板：

```vue
:value="chartModeIndex"
```

位置：`src/pages/behavior/HistoryData.vue:186`

### 16.3 `currentChartType`

位置：`src/pages/behavior/HistoryData.vue:289`

作用：根据 `chartTypeIndex` 得到当前图表类型：

```js
"line" 或 "bar"
```

用于：

- `UChartCanvas :type`
- `normalizeChartSeries()`

### 16.4 `startDateTimeText`

位置：`src/pages/behavior/HistoryData.vue:290`

调用链：

```text
startDateTimeText
  ↓
buildDateTimeText(startDate, startTime, false)
  ↓
normalizeTimeText()
```

用于传给 `DateTimePickerField`：

```vue
:start-value="startDateTimeText"
```

位置：`src/pages/behavior/HistoryData.vue:42`

### 16.5 `endDateTimeText`

位置：`src/pages/behavior/HistoryData.vue:293`

调用链：

```text
endDateTimeText
  ↓
buildDateTimeText(endDate, endTime, true)
  ↓
normalizeTimeText()
```

用于传给 `DateTimePickerField`：

```vue
:end-value="endDateTimeText"
```

位置：`src/pages/behavior/HistoryData.vue:43`

### 16.6 `formattedTableData`

位置：`src/pages/behavior/HistoryData.vue:297`

作用：把后端返回的数组结构转成模板更容易展示的对象结构。

后端每行类似：

```js
[
  { f_name: "设备编号", value: "xxx" },
  { f_name: "温度", value: 20 },
]
```

转成：

```js
{
  "设备编号": "xxx",
  "温度": 20
}
```

模板使用：

```vue
row[header.prop]
```

位置：`src/pages/behavior/HistoryData.vue:130`

### 16.7 `filteredTableHeader`

位置：`src/pages/behavior/HistoryData.vue:308`

作用：根据全局开关决定是否显示设备编号列。

```js
if (appStore.value.settings.showDeviceFeatures) {
  return tableHeader.value
}
return tableHeader.value.filter((col) => col.prop !== "设备编号")
```

也就是说：

- 设备功能开启：显示设备编号列
- 设备功能关闭：隐藏设备编号列

模板表头和表体都用它：

- 表头：`src/pages/behavior/HistoryData.vue:79`
- 表体：`src/pages/behavior/HistoryData.vue:94`

## 17. 各功能的总调用图

### 17.1 首次进入页面

```text
onMounted
  ├─ fetchData
  │   ├─ buildTableQueryParams
  │   │   ├─ buildDateTimeParam
  │   │   │   └─ buildDateTimeText
  │   │   │       └─ normalizeTimeText
  │   │   └─ buildDateTimeParam
  │   │       └─ buildDateTimeText
  │   │           └─ normalizeTimeText
  │   ├─ getFormatPaged
  │   ├─ normalizeTableResponse
  │   └─ applyTableResponse
  │       └─ updateChartFromCurrentPage
  │           ├─ clearScheduledChartRefresh
  │           ├─ buildChartDataFromTableData
  │           │   └─ findFieldByName
  │           ├─ normalizeChartSeries
  │           └─ createValueAxisConfig
  ├─ wsClient.on
  └─ wsClient.send subscribe
```

### 17.2 点击查询

```text
onFilter
  ├─ 如果 showDeviceFeatures=false，清空 d_no
  ├─ currentPage = 1
  ├─ fetchData
  │   └─ applyTableResponse
  │       └─ 如果 page 模式：updateChartFromCurrentPage
  └─ 如果 range 模式：
      ├─ clearScheduledChartRefresh
      └─ fetchChartData
          ├─ buildChartQueryParams
          ├─ getFormatChart
          ├─ normalizeChartResponse
          │   ├─ alignChartDataToCategories
          │   ├─ downsampleChartData
          │   ├─ normalizeChartSeries
          │   └─ createValueAxisConfig
          └─ applyChartResponse
              └─ appendLatestTablePointToRangeChart
```

### 17.3 点击重置

```text
onReset
  ├─ 清空 d_no
  ├─ 清空 startDate / endDate
  ├─ 重置 startTime / endTime
  ├─ currentPage = 1
  ├─ fetchData
  │   └─ page 模式下 updateChartFromCurrentPage
  └─ range 模式下 fetchChartData
```

### 17.4 翻页

```text
prevPage / nextPage
  ├─ 修改 currentPage
  └─ fetchData
      └─ page 模式下 updateChartFromCurrentPage
```

### 17.5 修改每页条数

```text
onPageSizeChange
  ├─ pageSizeIndex = e.detail.value
  ├─ pageSize = pageSizes[e.detail.value]
  ├─ currentPage = 1
  └─ fetchData
      └─ page 模式下 updateChartFromCurrentPage
```

### 17.6 切换到当前页明细

```text
onChartModeChange
  ├─ readEventValue
  ├─ chartDataMode = "page"
  └─ updateChartFromCurrentPage
      ├─ clearScheduledChartRefresh
      ├─ chartRequestId += 1
      ├─ buildChartDataFromTableData
      ├─ normalizeChartSeries
      └─ createValueAxisConfig
```

### 17.7 切换到趋势总览

```text
onChartModeChange
  ├─ readEventValue
  ├─ chartDataMode = "range"
  ├─ clearScheduledChartRefresh
  ├─ lastChartFetchAt = 0
  └─ fetchChartData
      ├─ buildChartQueryParams
      ├─ getFormatChart
      ├─ normalizeChartResponse
      └─ applyChartResponse
          └─ appendLatestTablePointToRangeChart
```

### 17.8 切换折线图 / 柱状图

```text
onChartTypeChange
  ├─ readEventValue
  ├─ chartTypeIndex = index
  └─ normalizeChartSeries(chartSeries, currentChartType)
      ↓
      UChartCanvas 重绘
```

### 17.9 收到 WebSocket 推送

```text
handleWsData
  └─ shouldRefreshChartFromWs
      ├─ 判断设备编号
      ├─ 判断 timestamp
      ├─ parseDateTime(start)
      │   └─ normalizeTimeText
      ├─ parseDateTime(end)
      │   └─ normalizeTimeText
      └─ 判断是否在时间范围内

如果 true：
  ↓
scheduleHistoryRefresh
  ├─ clearScheduledHistoryRefresh
  └─ setTimeout 400ms
      ├─ fetchData
      │   └─ page 模式下 updateChartFromCurrentPage
      └─ range 模式下 scheduleChartRefresh
          ├─ clearScheduledChartRefresh
          └─ setTimeout 节流
              └─ fetchChartData
```

### 17.10 离开页面

```text
onUnmounted
  ├─ wsClient.off("behavior_update", handleWsData)
  ├─ clearScheduledChartRefresh
  └─ clearScheduledHistoryRefresh
```

## 18. 最重要的性能控制点

### 18.1 首屏默认 `page`

位置：`src/pages/behavior/HistoryData.vue:252`

```js
const chartDataMode = ref("page")
```

目的：避免进入页面马上请求趋势图接口。

### 18.2 趋势图请求防并发

位置：`src/pages/behavior/HistoryData.vue:469`

```js
if (isChartFetching) {
  hasPendingChartRefresh = true
  return
}
```

目的：避免多个趋势图请求同时飞出去。

### 18.3 趋势图请求防旧结果覆盖

位置：`src/pages/behavior/HistoryData.vue:458`

```js
if (requestId !== chartRequestId || chartDataMode.value !== "range") return
```

目的：用户切模式或重新查询后，旧请求回来不能覆盖新状态。

### 18.4 WebSocket 表格刷新 debounce

位置：`src/pages/behavior/HistoryData.vue:553`

```js
scheduleHistoryRefresh()
```

目的：短时间多条推送只刷新一次表格。

### 18.5 WebSocket 趋势图刷新 throttle

位置：`src/pages/behavior/HistoryData.vue:536`

```js
scheduleChartRefresh()
```

目的：趋势图接口比较重，实时推送不能每次都直接拉。

## 19. 一句话总结执行模型

历史页现在的模型是：

```text
表格是主数据源；
当前页明细图表直接从表格生成；
趋势总览图表才单独请求图表接口；
用户主动操作立即刷新；
WebSocket 被动更新先判断筛选命中，再 debounce 表格、throttle 趋势图。
```
