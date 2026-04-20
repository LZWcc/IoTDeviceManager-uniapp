# CLAUDE.md

## Repository Reality

- 当前 Git 主线是一个 **uni-app 前端项目**，活跃代码都在 `src/`。
- 当前工作区同时存在两个本地旁路目录：
  - `backend/`: 真实可运行的 Node/Express + MySQL + MQTT + WebSocket + AI 代理后端，但被 `.gitignore` 忽略。
  - `original-project/`: 迁移前的 Vue Web 版参考项目，也被 `.gitignore` 忽略。
- 因此，这个仓库的真实形态更接近“**前端主仓库 + 本地配套后端 + 旧版参考工程**”。
- `README.md` 与当前代码不一致，后续协作必须以代码为准。

## Project Overview

### Frontend

- 前端定位：IoT 设备管理与监控界面，支持设备管理、实时数据、历史数据、指令配置、错误查看、AI 对话。
- 前端框架：uni-app + Vue 3。
- 当前默认首页不是 `src/pages/index/index.vue`，而是 `src/pages.json` 里第一个页面：`pages/sensor/RealtimeData`。
- 当前代码和部署文档明显以 H5 演示为主，但保留了 uni-app 多端编译能力。

### Backend

- 基于当前本地 `backend/` 代码推断，后端职责包括：
  - 提供设备、历史数据、错误信息、指令配置、AI 聊天接口
  - 从 MQTT 收设备上报
  - 落库 MySQL
  - 向前端广播 WebSocket 更新
- 后端入口在 `backend/src/index.js`。

## Tech Stack

### Frontend

- 框架：`@dcloudio/uni-app` + Vue 3
- 构建：Vite 5 + `@dcloudio/vite-plugin-uni`
- 语言：JavaScript
- 图表：`@qiun/ucharts`
- 状态管理：`src/stores/index.js` 中的轻量 `ref` store
- 网络请求：`src/api/request.js` 基于 `uni.request`
- 实时通信：`src/utils/websocket.js` 基于 `uni.connectSocket`
- 样式：页面/组件内 `scoped` CSS 为主，少量 `scss`

### Backend

- 运行时：Node.js ESM
- 框架：Express 5
- 数据库：MySQL，连接封装在 `backend/src/db.js`
- WebSocket：`ws`
- MQTT：`mqtt`
- AI 代理：OpenAI SDK 调 DeepSeek；也支持转发 Ollama
- 日期处理：`moment`

### 旧版参考项目

- `original-project/` 使用的是 Vue 3 + Element Plus + vue-router + Pinia + ECharts
- 当前活跃 uni-app 前端 **没有** 继续使用这些方案

## Directory Guide

### Frontend: entry, routing, runtime

- `src/main.js`
  uni-app 应用入口，只做 `createSSRApp(App)`，没有注册 Pinia、Router、i18n 等额外插件。
- `src/App.vue`
  根组件，放了全局 CSS 变量、卡片/按钮/间距工具类，也有 `onLaunch/onShow/onHide` 生命周期日志。
- `src/pages.json`
  当前前端真实路由入口。页面是否能访问、是否在 tabBar 中，都由这里决定。
- `src/config/runtime.js`
  前端接口地址和 WebSocket 地址的唯一运行时来源。所有 HTTP/WS 地址都应该经过这里。
- `vite.config.js`
  关键配置只有三处：
  - `@ -> src`
  - `optimizeDeps.include = ["@qiun/ucharts"]`
  - `build.commonjsOptions.include = [/node_modules/]`

### Frontend: page layer

- `src/pages/sensor/RealtimeData.vue`
  传感器实时页。负责设备选择、页面间导航，把设备号传给卡片和图表组件。
- `src/pages/behavior/RealtimeData.vue`
  行为实时页。结构与传感器实时页几乎一模一样，只是 `type = "behavior"`。
- `src/pages/sensor/HistoryData.vue`
  传感器历史页。自己管理筛选条件、分页、表格、图表、WebSocket 刷新节流。
- `src/pages/behavior/HistoryData.vue`
  行为历史页。和传感器历史页几乎同构，只改了 `type`、topic、调试标签。
- `src/pages/device/DeviceManage.vue`
  设备 CRUD 页面。列表、抽屉表单、动态表头都在这里。
- `src/pages/config/DirectConfig.vue`
  指令配置页面。全局配置和按设备配置都在同一页。
- `src/pages/error/ErrorMsg.vue`
  错误信息筛选 + 分页 + WebSocket 头插更新。
- `src/pages/expand/AiChat.vue`
  AI 聊天页，支持普通调用和流式调用。
- `src/pages/index/index.vue`
  未注册页面，当前不是入口。
- `src/pages/index/index-simple.vue`
  同样未注册，当前不是入口。

### Frontend: component layer

- `src/components/device/BigSensorCard.vue`
  实时页顶部“基本信息”组件。它不是纯展示组件，会自己打接口、自己订阅 WebSocket。
- `src/components/charts/SensorCharts.vue`
  实时页图表组件。它也不是纯展示组件，会自己打接口、自己订阅 WebSocket。
- `src/components/charts/UChartCanvas.vue`
  当前图表底座。所有 uCharts 渲染、宽度计算、tooltip 兼容、H5 scroll 行为都在这里。
- `src/components/DateTimePickerField.vue`
  历史页的统一日期时间范围控件。一个弹层同时维护 start/end 两组值。
- `src/components/ConfigNode.vue`
  指令配置树的递归节点渲染器。
- `src/components/SensorCard.vue`
  空文件，当前无用，不要把它当成接入点。

### Frontend: state layer

- `src/stores/index.js`
  项目唯一 store。
  当前只存一组 `settings`：
  - `showDeviceFeatures`
  - `theme`
  - `language`
    其中真正被业务大量使用的是 `showDeviceFeatures`。

### Frontend: API layer

- `src/api/request.js`
  所有 HTTP 请求的底层封装。
- `src/api/device.js`
  设备管理 CRUD：`/api/device`
- `src/api/get_deviceList.js`
  实时页的设备号列表：`/api/device-list?type=sensor|behavior`
- `src/api/get_format_limit.js`
  当前最核心的数据接口文件：
  - `/api/format-limit-1/:d_no`
  - `/api/format-minute-avg/:d_no`
  - `/api/format-paged`
  - `/api/format-chart`
- `src/api/get_direct_config.js`
  指令配置接口：
  - `/api/get-direct-config`
  - `/api/save-config`
  - `/api/get-devices`
- `src/api/error.js`
  `/api/error`
- `src/api/send_message.js`
  `/api/ai/chat` 和 `/api/ai/chat/stream`
- `src/api/get_data.js` / `src/api/get_format.js` / `src/api/get_format_all.js`
  遗留接口文件，当前活跃页面没有使用，不要优先往这里接新功能。

### Backend: entry, routers, infra

- `backend/src/index.js`
  后端主入口，注册所有路由和数据查询接口。
- `backend/src/device.js`
  设备管理接口。
- `backend/src/error.js`
  错误分页接口。
- `backend/src/routes/directConfig.js`
  指令配置树查询和差量保存接口。
- `backend/src/routes/ai.js`
  AI 普通对话和流式对话接口。
- `backend/src/websocket/wsServer.js`
  WebSocket 服务端，topic 订阅/广播都在这里。
- `backend/src/mqtt/client.js`
  MQTT 客户端，负责订阅设备主题、落库和广播 WebSocket。
- `backend/src/db.js`
  MySQL 连接池。
- `backend/src/wusiqi.sql`
  数据库 schema 和示例数据。

## Frontend Architecture Notes

### Routing organization

- 当前项目不使用 `vue-router`，只使用 `src/pages.json`。
- 当前 `tabBar` 页有 4 个：
  - `pages/config/DirectConfig`
  - `pages/device/DeviceManage`
  - `pages/sensor/RealtimeData`
  - `pages/behavior/RealtimeData`
- 非 tabBar 页有：
  - `pages/sensor/HistoryData`
  - `pages/behavior/HistoryData`
  - `pages/error/ErrorMsg`
  - `pages/expand/AiChat`
- `src/utils/navigation.js` 封装了 `navigateToPage(url)`：
  - tabBar 页面走 `uni.switchTab`
  - 其他页面走 `uni.navigateTo`
- 结论：**新增页面时必须先改 `src/pages.json`；新增 tabBar 页面时还要同步改 `src/utils/navigation.js` 的 `TAB_BAR_PAGES`。**

### Page / component boundary

- 当前项目的页面层不是“纯容器层”，但边界相对清晰：
  - 实时页：页面负责导航和选设备；数据获取/实时更新下沉到 `BigSensorCard` 和 `SensorCharts`
  - 历史页：页面自己持有筛选、分页、图表和 WebSocket 刷新逻辑，没有抽出公共历史组件
  - 设备管理页：页面自己持有完整 CRUD 流程
  - 指令配置页：页面持有加载、快照、差量保存；递归渲染交给 `ConfigNode`
- 结论：**新增实时类页面时，优先沿用“页面只传 `selectDevice` + `type`，组件自己请求”的现有模式。新增历史类页面时，优先参考 `src/pages/sensor/HistoryData.vue` 整页模式。**

### State layer location

- 只有 `src/stores/index.js`。
- 当前没有 Pinia，没有模块化 store，也没有统一 action 层。
- `appStore.value.settings.showDeviceFeatures` 是一个关键全局开关，影响：
  - 实时页是否显示设备选择器
  - 历史页是否允许按设备号筛选
  - 错误页是否显示设备号筛选
  - 设备管理页是否显示设备编号字段
  - 指令配置页是否显示按设备配置区域
  - 实时卡片和图表标题是否显示设备号

### API layer location

- 所有 HTTP 都要从 `src/api/` 进入，底层统一走 `src/api/request.js`。
- 现有 API 文件不是按技术分层，而是按业务临时拆分，且返回结构不统一：
  - `getDevice()` 直接返回 `response.data`
  - `getFormatPaged()` 调用方读取 `res.data.data`
  - `getFormatChart()` 调用方读取 `res.data.data.times/series`
  - `sendAiMessage()` 返回整个响应对象，页面再读 `response.data`
- 结论：**新增接口时必须先决定返回结构要和哪个现有调用模式对齐，不要默认统一。**

### Style organization

- 全局样式：
  - `src/App.vue`: 当前真正被使用的全局 CSS 变量和公共类
  - `src/uni.scss`: uni-app 默认 SCSS 变量模板，当前业务代码大量使用的是字面量颜色，不是这里的变量
- 页面和组件样式：
  - 几乎都使用 `<style scoped>`
  - 大多是白底卡片、圆角、阴影、`#2979ff` 主色、`rpx` 尺寸
- 图表组件 `src/components/charts/SensorCharts.vue` 用的是 `<style lang="scss" scoped>`，其他多数是普通 scoped CSS。

### Environment and build notes

- 环境变量入口：
  - `.env.example`
  - `.env.production`
    这两个文件都被 `.gitignore` 忽略。
- 运行时地址统一从 `src/config/runtime.js` 导出：
  - `API_BASE_URL`
  - `WS_BASE_URL`
- `runtime.js` 会自动去掉 URL 末尾 `/`。
- 如果没配 `VITE_WS_BASE_URL`，它会从 `VITE_API_BASE_URL` 自动推导 `ws://` 或 `wss://`。
- 当前 `.env.production` 是：
  - `VITE_API_BASE_URL=https://iot.lzwcc.xyz`
  - `VITE_WS_BASE_URL=wss://iot.lzwcc.xyz/ws`
- 本地默认值是：
  - `http://127.0.0.1:8081`
  - `ws://127.0.0.1:8081`
- `src/manifest.json` 里的 `name`、`appid` 等仍为空，多端正式打包前要补齐。

## Backend Architecture Notes

### Real backend entry and route split

- `backend/src/index.js` 做了两类事情：
  - 挂 Express 路由：`deviceRouter`、`errorRouter`、`directConfigRouter`、`aiRouter`
  - 直接在入口文件里写数据查询接口：`/api/format-paged`、`/api/format-chart`、`/api/format-limit-1/:d_no`、`/api/device-list`、`/api/format-minute-avg/:d_no`
- 这意味着后端不是“所有接口都在 routes/”的纯路由式结构，改接口时要先确认它到底在 `routes/` 里还是在 `index.js` 里。

### Data model and mapping

- 数据库 schema 在 `backend/src/wusiqi.sql`。
- 核心表：
  - `t_sensor_data`
  - `t_behavior_data`
  - `t_sensor_field_mapper`
  - `t_behavior_field_mapper`
  - `t_device`
  - `t_direct`
  - `t_direct_config`
  - `t_error_msg`
- 当前后端强依赖映射表：
  - 前端展示名称来自 `f_name`
  - 数据库列来自 `db_name`
  - MQTT 上报字段来自 `p_name`
- 这也是前端为什么大量使用 `f_name` / `db_name` 而不是更语义化字段名。

### MQTT -> DB -> WebSocket flow

- `backend/src/mqtt/client.js` 会订阅这些主题：
  - `device/behavior`
  - `device/sensor`
  - `device/error`
  - `device/direct`
  - `device/heartbeat`
  - `device/power_on`
- 收到 `sensor` 或 `behavior` 消息后：
  1. 用映射表把 `p_name` 映射到 `field1-field10`
  2. 写入 `t_sensor_data` 或 `t_behavior_data`
  3. 通过 `wsService.sendToSubscribers()` 广播 `sensor_update` 或 `behavior_update`
- 收到 `error` 消息后：
  1. 写入 `t_error_msg`
  2. 广播 `error_update`

### Command config flow

- 前端 `DirectConfig.vue` -> `src/api/get_direct_config.js`
- 后端 `backend/src/routes/directConfig.js`
- 数据来源：
  - 配置模板：`t_direct_config`
  - 已保存实例值：`t_direct`
- 保存时：
  1. 后端开启事务
  2. 更新/插入 `t_direct`
  3. 提交成功后再通过 MQTT 发送指令
- 注意：`directConfigRouter` 引入了 `mqtt/client.js`，所以后端启动时会顺带启动 MQTT 客户端副作用。

## Existing Code Patterns

### Pattern 1: `sensor` / `behavior` 双套同构

- `src/pages/sensor/RealtimeData.vue` 和 `src/pages/behavior/RealtimeData.vue` 基本同构
- `src/pages/sensor/HistoryData.vue` 和 `src/pages/behavior/HistoryData.vue` 也基本同构
- 后端也有统一 `tableMap`：
  - 前端：按 `type` 传 `sensor` / `behavior`
  - 后端：按 `type` 映射 `t_sensor_*` / `t_behavior_*`
- 结论：**改一边时几乎总要看另一边。**

### Pattern 2: 实时页由子组件自己拉数据

- 实时页不会先把数据请求完再传给子组件。
- 当前模式是：
  - 页面负责选设备
  - `BigSensorCard.vue` 自己请求 `/api/format-limit-1/:d_no`
  - `SensorCharts.vue` 自己请求 `/api/format-minute-avg/:d_no`
  - 两者都各自订阅 WebSocket

### Pattern 3: 历史页自己持有完整页面状态

- 历史页内部维护：
  - `d_no`
  - `startDate/startTime`
  - `endDate/endTime`
  - `currentPage/pageSize`
  - `chartTypeIndex`
  - `chartCategories/chartSeries/chartYAxis`
- 表格和图表是两个请求，不是一个接口返回一切。

### Pattern 4: 指令配置是“快照比对 + debounce 自动保存”

- `DirectConfig.vue` 不需要用户点保存按钮。
- 它会：
  - 加载配置树
  - 初始化默认值
  - 收集一份扁平快照
  - 深度 watch
  - debounce 后只提交变更项

### Pattern 5: 表头/字段很多地方依赖后端返回结构

- `DeviceManage.vue` 会用返回对象 key 自动生成表头。
- 历史页会用返回数组里每个字段的 `f_name/unit` 生成表头。
- `BigSensorCard.vue` 直接展示后端格式化后的字段列表。
- 结论：**后端字段顺序、命名、可见性一变，前端很多地方会一起变。**

## Where New Features Should Enter

### 新增页面

- 从 `src/pages.json` 接入。
- 如果是 tabBar 页：
  - 改 `src/pages.json`
  - 同步改 `src/utils/navigation.js`
- 如果只是普通页面：
  - 改 `src/pages.json`
  - 从现有页面用 `navigateToPage()` 跳转

### 新增实时业务页

- 优先参考：
  - `src/pages/sensor/RealtimeData.vue`
  - `src/components/device/BigSensorCard.vue`
  - `src/components/charts/SensorCharts.vue`
- 现有接入方式不是“把组件变纯”，而是给组件传：
  - `selectDevice`
  - `type`

### 新增历史类页面或筛选逻辑

- 优先从 `src/pages/sensor/HistoryData.vue` 复制现有模式。
- 当前项目并没有抽出共享的 `HistoryPage` 组件，直接沿用页面模式最贴近现状。
- 时间筛选统一从 `src/components/DateTimePickerField.vue` 进入，不要重新造日期范围控件。

### 新增接口

- 从 `src/api/` 进入，底层走 `src/api/request.js`
- 后端如果是活跃数据接口，通常会落在：
  - `backend/src/index.js`
  - `backend/src/device.js`
  - `backend/src/error.js`
  - `backend/src/routes/directConfig.js`
  - `backend/src/routes/ai.js`

### 新增全局设置

- 从 `src/stores/index.js` 的 `settings` 接入。
- 如果这个设置要持久化，沿用 `updateSettings()` + `uni.setStorageSync("appSettings")` 的现有做法。

### 新增指令配置类型

- 先看后端 `t_direct_config.f_type`。
- 再看前端 `ConfigNode.vue` 是否支持该类型。
- 当前 `ConfigNode.vue` 只实际渲染了 `f_type` 1/2/3，4/5 在 schema 和 `DirectConfig.vue` 初始化逻辑里存在，但 UI 未实现。

## Public Abstractions You Should Not Bypass

- `src/config/runtime.js`
  所有 API/WS 地址都要走这里，不要在页面或 API 文件里手写 base URL。
- `src/api/request.js`
  不要在页面里直接 `uni.request`。
- `src/utils/navigation.js`
  不要在页面里随手写 `navigateTo` / `switchTab` 混用逻辑。
- `src/utils/websocket.js`
  不要在页面或组件里自己新建 socket 连接。
- `src/components/charts/UChartCanvas.vue`
  当前图表兼容层都在这里，不要绕过它直接在页面里重造 uCharts 初始化。
- `src/utils/ucharts.js`
  图表序列归一化、Y 轴范围、下采样逻辑都已经在这里。
- `src/components/DateTimePickerField.vue`
  历史页日期时间筛选不要绕开它再做一套。
- `src/stores/index.js`
  全局设置不要直接散落到页面本地存储里。

## Current Project Rules From Real Code

- 新增实时功能时，优先把“数据获取 + WebSocket 增量更新”放到组件内部，而不是塞回页面。
- 新增历史筛选时，优先保持 `date` / `time` 分开存储，再通过 `buildDateTimeParam()` 组装参数。
- 新增传感器/行为类功能时，默认要同时考虑两套页面，而不是只改一处。
- 改设备可见性相关需求时，先搜索 `showDeviceFeatures`，因为它跨多个页面生效。
- 改图表展示时，先查：
  - `src/components/charts/SensorCharts.vue`
  - `src/components/charts/UChartCanvas.vue`
  - `src/utils/ucharts.js`
  - 历史页本身的图表数据拼装逻辑

## Most Fragile / Easy-To-Break Areas

- `src/pages/sensor/HistoryData.vue`
- `src/pages/behavior/HistoryData.vue`
  这两页不仅长，而且包含 H5 日期输入调试代码、DOM 探测、WebSocket 图表刷新节流。不要轻易“顺手清理”。
- `src/components/DateTimePickerField.vue`
  它一个组件维护 start/end 两组值，并且限制未来时间。这里很容易改出跨端问题。
- `src/components/charts/UChartCanvas.vue`
  它处理了 H5 和非 H5 的画布尺寸、tooltip、scroll、重绘节流。不要把它当普通简单 canvas 包装器。
- `src/pages/config/DirectConfig.vue`
  差量自动保存依赖：
  - 初始化锁
  - 快照
  - 扁平收集
  - debounce
    任意一步改坏都会导致误保存、重复保存或初始加载时就触发保存。
- `src/api/get_deviceList.js` 和 `src/api/get_direct_config.js`
  两个文件里都有 `getDeviceList()`，但语义完全不同：
  - 一个取实时数据设备号列表
  - 一个取指令配置设备列表
    这是非常容易导错的点。
- `src/pages/device/DeviceManage.vue`
  表头是根据接口返回对象 key 动态生成的，后端字段一改，这里会直接变。
- `backend/src/index.js`
  既是应用入口又直接写了多个数据查询接口，不是纯路由分层。
- `backend/src/routes/directConfig.js`
  保存成功后还会触发 MQTT 下发，改这里不是单纯改数据库。

## Common Pitfalls

- `README.md` 不可信，内容明显滞后于当前代码。
- `AGENTS.md` 写的是 `pnpm dev`，但根 `package.json` 实际没有这个脚本，当前可用的是 `pnpm dev:h5`。
- `.env.example`、`.env.production`、`backend/`、`original-project/` 都被忽略，普通 `git`/默认搜索容易漏掉。
- `src/pages/index/*` 存在，但没有注册到 `src/pages.json`。
- `src/api/get_format.js` 的相对导入路径是错的：`../request.js`；当前没被使用，所以没有暴露出来。
- 当前项目安装了 `vue-i18n`，但前端并未接入。
- `ConfigNode.vue` 只实现了 `f_type` 1/2/3；后端 schema 中已经出现 `4`、`5`。
- 历史页的 WebSocket 收到数据后不会直接插表格，只会按时间范围触发图表刷新调度。这是现有行为，不要误改成“收到消息就重刷全页”。
- 后端 `mqtt/client.js` 在 import 时就实例化，启动依赖是隐式副作用，不是手动 `new` 出来的。

## Development Commands

### Frontend

- `pnpm install`
- `pnpm dev:h5`
- `pnpm build:h5`
- `pnpm dev:mp-weixin`
- `pnpm build:mp-weixin`
- 其他端按根目录 `package.json` 的 `dev:*` / `build:*` 脚本执行

### Backend

- 基于当前本地 `backend/` 代码推断：
  - `cd backend`
  - `pnpm install`
  - `node src/index.js`
- `backend/package.json` 没有现成 `dev` 脚本。

### What does not currently exist

- 根目录没有 `lint`
- 根目录没有 `format`
- 根目录没有 `test`
- 根目录没有 `preview`

## Safe Workflow for Future Changes

1. 先确认你改的是前端主线 `src/`，还是本地后端 `backend/`。
2. 前端改页面前，先看 `src/pages.json` 和是否属于 tabBar。
3. 再看这个页面是“页面自己请求数据”还是“子组件自己请求数据”。
4. 改接口前，先确认调用方读取的是 `response.data`、`res.data.data`，还是更外层对象。
5. 改实时模块时，同时检查：
   - `BigSensorCard.vue`
   - `SensorCharts.vue`
   - `src/utils/websocket.js`
   - 后端 WebSocket topic
6. 改历史模块时，同时检查：
   - `DateTimePickerField.vue`
   - 历史页自身的 `buildDateTimeParam` / `applyDateTimeValue`
   - 图表下采样和 Y 轴逻辑
7. 改指令配置时，同时检查：
   - 前端 `DirectConfig.vue`
   - 前端 `ConfigNode.vue`
   - 后端 `routes/directConfig.js`
   - 数据库 `t_direct_config`
8. 改设备号/设备展示逻辑时，先全局搜索 `showDeviceFeatures`。
9. 搜索全项目时，必要时用能看到忽略目录的搜索方式，否则会漏掉 `backend/` 和 `original-project/`。

## Quick Reference

### Frontend route source

- `src/pages.json`

### Frontend state source

- `src/stores/index.js`

### Frontend request base

- `src/api/request.js`

### Frontend WebSocket base

- `src/utils/websocket.js`

### Frontend chart base

- `src/components/charts/UChartCanvas.vue`

### Frontend date range base

- `src/components/DateTimePickerField.vue`

### Backend entry

- `backend/src/index.js`

### Backend realtime sources

- `backend/src/mqtt/client.js`
- `backend/src/websocket/wsServer.js`

### Backend schema

- `backend/src/wusiqi.sql`
