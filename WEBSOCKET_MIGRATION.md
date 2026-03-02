# WebSocket 迁移指南

## 概述

已创建 uni-app 兼容的 WebSocket 客户端 (`src/utils/websocket.js`)，支持 H5、小程序、App 多平台。

## 已完成的工作

### 1. 创建 WebSocket 客户端 (`src/utils/websocket.js`)

- ✅ 使用 `uni.connectSocket` API，兼容多平台
- ✅ 自动重连机制（3秒间隔）
- ✅ 心跳保活（30秒间隔）
- ✅ 消息订阅/取消订阅
- ✅ 错误处理和日志记录

### 2. 主要 API

```javascript
import wsClient from "@/utils/websocket"

// 订阅消息
wsClient.on("sensor_update", (data) => {
  console.log("收到传感器数据:", data)
})

// 发送消息
wsClient.send({
  type: "subscribe",
  topics: ["sensor_update"],
})

// 取消订阅
wsClient.off("sensor_update", callback)

// 检查连接状态
wsClient.isConnected()

// 关闭连接
wsClient.close()
```

## 需要修改的文件

### 1. `src/components/echarts/SensorCharts.vue` ⚠️

**当前状态：** WebSocket 代码已注释

**需要做的修改：**

#### Step 1: 导入 WebSocket 客户端

在 `<script setup>` 顶部添加：

```javascript
import wsClient from "@/utils/websocket"
```

#### Step 2: 取消注释 onMounted 中的 WebSocket 代码

找到第 172-177 行，取消注释：

```javascript
onMounted(async () => {
  // ... 现有代码 ...

  // 取消下面这些行的注释：
  const topic = props.type === "sensor" ? "sensor_update" : "behavior_update"
  wsClient.on(topic, handleWsData)
  wsClient.send({
    type: "subscribe",
    topics: [topic],
  })
})
```

#### Step 3: 取消注释 onUnmounted 中的清理代码

找到第 184-185 行，取消注释：

```javascript
onUnmounted(() => {
  const topic = props.type === "sensor" ? "sensor_update" : "behavior_update"
  wsClient.off(topic, handleWsData)

  // ... 其他清理代码 ...
})
```

**完整的修改代码段：**

```vue
<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue"
import { getFormatMinuteAvg } from "@/api/get_format_all"
import { formatDate } from "@/utils/index"
import wsClient from "@/utils/websocket" // ← 添加这行

// ... 其他代码保持不变 ...

onMounted(async () => {
  // ... 现有的 echarts 加载代码 ...

  // 启用 WebSocket 监听
  const topic = props.type === "sensor" ? "sensor_update" : "behavior_update"
  wsClient.on(topic, handleWsData)
  wsClient.send({
    type: "subscribe",
    topics: [topic],
  })

  // #ifdef H5
  window.addEventListener("resize", handleResize)
  // #endif
})

onUnmounted(() => {
  // 清理 WebSocket 监听
  const topic = props.type === "sensor" ? "sensor_update" : "behavior_update"
  wsClient.off(topic, handleWsData)

  // #ifdef H5
  window.removeEventListener("resize", handleResize)
  if (myChart) {
    myChart.dispose()
    myChart = null
  }
  // #endif
})
</script>
```

---

### 2. `src/components/echarts/BigSensorCard.vue` ⚠️

**当前状态：** 有注释提示需要实现 WebSocket

**需要做的修改：**

#### Step 1: 导入依赖

```javascript
import wsClient from "@/utils/websocket"
```

#### Step 2: 添加 WebSocket 监听

在 `onMounted` 中添加：

```javascript
onMounted(async () => {
  await fetchData()

  // 添加 WebSocket 实时更新
  const topic = props.type === "sensor" ? "sensor_update" : "behavior_update"

  const handleWsUpdate = (data) => {
    if (data.d_no !== props.selectDevice) return
    console.log("BigSensorCard received WS data:", data)

    // 更新卡片数据
    cardData.value = cardData.value.map((card) => {
      if (card.db_name && data[card.db_name] !== undefined) {
        return {
          ...card,
          value: data[card.db_name],
        }
      }
      return card
    })
  }

  wsClient.on(topic, handleWsUpdate)
  wsClient.send({
    type: "subscribe",
    topics: [topic],
  })

  // 保存 handler 以便清理
  currentWsHandler.value = handleWsUpdate
})

onUnmounted(() => {
  if (currentWsHandler.value) {
    const topic = props.type === "sensor" ? "sensor_update" : "behavior_update"
    wsClient.off(topic, currentWsHandler.value)
  }
})
```

需要在 `<script setup>` 顶部添加：

```javascript
const currentWsHandler = ref(null)
```

---

## 后端要求

WebSocket 服务器需要：

### 1. 消息格式

```javascript
// 客户端订阅
{
  type: 'subscribe',
  topics: ['sensor_update', 'behavior_update']
}

// 服务端推送数据
{
  type: 'sensor_update',  // 或 'behavior_update'
  data: {
    d_no: '2022',         // 设备编号
    timestamp: 1234567890, // 时间戳
    temperature: 25.5,     // 数据字段（根据实际情况）
    humidity: 60,
    // ... 其他字段
  }
}

// 心跳
{
  type: 'ping'
}
```

### 2. 心跳响应

服务器应该响应心跳：

```javascript
// 收到 ping 后返回
{
  type: "pong"
}
```

---

## 配置说明

### 修改 WebSocket 服务器地址

编辑 `src/utils/websocket.js` 的第 211 行：

```javascript
const wsClient = new WebSocketClient("ws://your-server:port")
```

### 修改重连和心跳间隔

在 `WebSocketClient` 构造函数中：

```javascript
this.reconnectInterval = 3000 // 重连间隔 3秒
this.heartbeatInterval = 30000 // 心跳间隔 30秒
```

---

## 测试步骤

### 1. 启动 WebSocket 服务器

确保后端 WebSocket 服务运行在 `ws://localhost:8081`

### 2. 检查连接

打开浏览器控制台，应该看到：

```
✅ WebSocket 连接已打开
📬 已订阅消息类型: sensor_update
```

### 3. 测试实时更新

后端推送数据后，图表和卡片应该自动更新

### 4. 测试重连

关闭后端服务，应该看到：

```
WebSocket 连接已关闭
🔄 正在尝试重连 WebSocket...
```

---

## 注意事项

1. **跨域问题**
   - H5 环境下可能遇到跨域，需要配置 `manifest.json` 的 `h5.devServer.proxy`
2. **小程序限制**
   - 小程序需要在后台配置合法域名（wss://）
   - 不支持 ws://，仅支持 wss://（生产环境）

3. **数据格式匹配**
   - 确保后端推送的数据字段与前端 `db_name` 匹配
   - 参考 `handleWsData` 函数中的数据处理逻辑

4. **性能优化**
   - 高频数据更新时考虑节流（throttle）
   - 大量数据时限制图表数据点数量

---

## 快速启用清单

- [ ] 确认后端 WebSocket 服务已启动
- [ ] 修改 `src/utils/websocket.js` 中的服务器地址
- [ ] 在 `SensorCharts.vue` 中导入并启用 WebSocket
- [ ] 在 `BigSensorCard.vue` 中导入并启用 WebSocket
- [ ] 测试连接和数据更新
- [ ] 检查控制台日志
- [ ] 验证自动重连功能

---

## 常见问题

**Q: 连接失败怎么办？**
A: 检查服务器地址、端口、后端服务是否启动

**Q: 数据不更新？**
A: 检查订阅的 topic 是否正确，数据格式是否匹配

**Q: 小程序无法连接？**
A: 确保使用 wss:// 协议，并在小程序后台配置合法域名

**Q: 频繁重连？**
A: 检查后端是否正确处理心跳，是否主动关闭连接
