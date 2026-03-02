# 路由对照表

## 原项目 Vue Router → uni-app pages.json 映射关系

| 原路由路径                | 原组件路径                        | uni-app页面路径               | 说明                       |
| ------------------------- | --------------------------------- | ----------------------------- | -------------------------- |
| `/`                       | 重定向                            | `pages/sensor/RealtimeData`   | 默认首页改为传感器实时数据 |
| `/sensor/realtime-data`   | `views/sensor/RealtimeData.vue`   | `pages/sensor/RealtimeData`   | 传感器实时数据 ✅          |
| `/sensor/history-data`    | `views/sensor/HistoryData.vue`    | `pages/sensor/HistoryData`    | 传感器历史数据 ✅          |
| `/ai-chat`                | `views/expand/AiChat.vue`         | `pages/expand/AiChat`         | AI智能助手 ✅              |
| `/behavior/realtime-data` | `views/behavior/RealtimeData.vue` | `pages/behavior/RealtimeData` | 行为实时数据 ✅            |
| `/behavior/history-data`  | `views/behavior/HistoryData.vue`  | `pages/behavior/HistoryData`  | 行为历史数据 ✅            |
| `/device/device-manage`   | `views/device/DeviceManage.vue`   | `pages/device/DeviceManage`   | 设备管理 ✅                |
| `/error-msg`              | `views/error/ErrorMsg.vue`        | `pages/error/ErrorMsg`        | 错误信息 ✅                |
| `/device/direct-config`   | `views/DirectConfig.vue`          | `pages/config/DirectConfig`   | 指令配置 ✅                |

## 页面导航方法对照

### 原项目 (Vue Router)

```javascript
// 编程式导航
this.$router.push('/sensor/realtime-data')
this.$router.push({ name: 'realtime-data' })

// 声明式导航
<router-link to="/sensor/realtime-data">传感器</router-link>
```

### uni-app

```javascript
// 编程式导航 (保留在当前页面栈)
uni.navigateTo({
  url: '/pages/sensor/RealtimeData'
})

// 跳转到tabBar页面
uni.switchTab({
  url: '/pages/sensor/RealtimeData'
})

// 关闭当前页面跳转
uni.redirectTo({
  url: '/pages/sensor/RealtimeData'
})

// 返回上一页
uni.navigateBack()

// 声明式导航
<navigator url="/pages/sensor/RealtimeData">传感器</navigator>
```

## TabBar 配置

按照原项目的底部导航，配置了3个标签页：

1. **传感器** - `pages/sensor/RealtimeData`
2. **行为** - `pages/behavior/RealtimeData`
3. **设备** - `pages/device/DeviceManage`

## 页面功能说明

### 1. 传感器模块

- **实时数据** (`pages/sensor/RealtimeData`): 显示传感器实时监控数据
- **历史数据** (`pages/sensor/HistoryData`): 查询和分析历史数据趋势

### 2. 行为模块

- **实时数据** (`pages/behavior/RealtimeData`): 监控系统行为实时数据
- **历史数据** (`pages/behavior/HistoryData`): 查看历史行为记录

### 3. 设备管理

- **设备管理** (`pages/device/DeviceManage`): 管理所有IoT设备

### 4. 扩展功能

- **AI助手** (`pages/expand/AiChat`): AI智能对话助手

### 5. 系统管理

- **错误信息** (`pages/error/ErrorMsg`): 查看和管理系统错误
- **指令配置** (`pages/config/DirectConfig`): 配置设备控制指令

## 注意事项

1. **首页默认路径**: uni-app的pages.json中第一个页面即为默认首页，已设置为`pages/sensor/RealtimeData`
2. **TabBar页面**: TabBar中的页面只能使用`uni.switchTab`进行跳转
3. **页面栈限制**: uni-app默认页面栈最多10层，需要注意页面跳转方式的选择
4. **路径格式**: uni-app中页面路径以`/`开头，不需要文件扩展名

## 开发建议

1. 使用`uni.navigateTo`进行普通页面跳转（非TabBar页面）
2. 使用`uni.switchTab`跳转到TabBar页面
3. 使用`uni.redirectTo`替换当前页面，可以节省页面栈
4. 合理使用`uni.reLaunch`重启应用到指定页面（会清空页面栈）
