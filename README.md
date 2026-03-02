# IoT设备管理系统 - uni-app版本

## 项目简介

基于uni-app框架开发的物联网设备管理系统，支持多端发布（H5、小程序、App等）。

## 项目结构

```
IotDeviceManager-uniapp/
├── index.html                    # H5页面入口
├── package.json                  # 项目依赖配置
├── pnpm-lock.yaml               # 依赖锁定文件
├── vite.config.js               # Vite构建配置
├── shims-uni.d.ts               # TypeScript声明文件
├── src/                         # 源码目录
│   ├── main.js                  # 应用入口文件
│   ├── App.vue                  # 根组件
│   ├── pages.json               # 页面路由配置
│   ├── manifest.json            # 应用配置文件
│   ├── uni.scss                 # 全局样式
│   ├── pages/                   # 页面目录
│   │   ├── index/              # 首页
│   │   │   └── index.vue       # 首页组件
│   │   ├── sensor/             # 传感器相关页面
│   │   │   ├── RealtimeData.vue # 实时数据页面
│   │   │   └── HistoryData.vue  # 历史数据页面
│   │   └── device/             # 设备管理页面
│   │       └── DeviceManage.vue # 设备管理页面
│   ├── components/             # 公共组件
│   │   ├── Loading.vue         # 加载组件
│   │   └── DataCard.vue        # 数据卡片组件
│   ├── api/                    # API接口
│   │   ├── request.js          # 网络请求封装
│   │   └── index.js            # API接口定义
│   ├── stores/                 # 状态管理
│   │   └── index.js            # 应用状态
│   ├── utils/                  # 工具函数
│   │   └── index.js            # 公共工具函数
│   └── static/                 # 静态资源
└── backend/                    # 后端API服务
    ├── app.js                  # 服务器入口
    ├── package.json            # 后端依赖
    ├── routes/                 # 路由目录
    ├── models/                 # 数据模型
    └── middleware/             # 中间件
```

## 功能特性

### 前端功能

- ✅ **首页概览**: 设备状态统计、最近活动展示
- ✅ **实时数据监控**: 传感器数据实时查看、自动刷新
- ✅ **历史数据分析**: 按日期查询、多类型数据切换
- ✅ **设备管理**: 设备列表、状态监控、远程控制
- ✅ **响应式设计**: 适配多种屏幕尺寸
- ✅ **组件化开发**: 可复用的UI组件

### 后端功能

- ✅ **RESTful API**: 标准化接口设计
- ✅ **安全防护**: 请求限制、CORS配置、安全头
- ✅ **错误处理**: 统一错误处理机制
- ✅ **日志记录**: 详细的请求日志

## 技术栈

### 前端

- **框架**: uni-app (Vue 3)
- **构建工具**: Vite
- **语言**: JavaScript
- **样式**: SCSS
- **状态管理**: Vue Reactive API

### 后端

- **运行环境**: Node.js
- **框架**: Express
- **安全**: Helmet, CORS, Rate Limiting
- **日志**: Morgan

## 开发环境搭建

### 前端开发

```bash
# 安装依赖
pnpm install

# 启动H5开发服务器
pnpm run dev:h5

# 构建H5版本
pnpm run build:h5

# 启动微信小程序开发
pnpm run dev:mp-weixin
```

### 后端开发

```bash
cd backend

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产环境启动
npm start
```

## 页面说明

### 1. 首页 (pages/index/index.vue)

- 应用入口页面
- 功能导航卡片
- 设备状态统计
- 最近活动展示

### 2. 实时数据 (pages/sensor/RealtimeData.vue)

- 传感器实时数据展示
- 支持手动刷新
- 数据卡片式布局
- 状态指示器

### 3. 历史数据 (pages/sensor/HistoryData.vue)

- 按日期查询历史数据
- 多种数据类型切换
- 24小时数据趋势
- 滚动列表展示

### 4. 设备管理 (pages/device/DeviceManage.vue)

- 设备列表展示
- 搜索功能
- 设备状态统计
- 设备控制操作

## 组件说明

### 1. Loading组件 (components/Loading.vue)

- 统一的加载状态展示
- 支持自定义文本
- 动画效果

### 2. DataCard组件 (components/DataCard.vue)

- 数据展示卡片
- 支持状态指示
- 趋势展示
- 可扩展操作区

## API接口

### 传感器数据

- `GET /api/sensor/realtime` - 获取实时数据
- `GET /api/sensor/history` - 获取历史数据
- `GET /api/sensor/list` - 获取传感器列表

### 设备管理

- `GET /api/device/list` - 获取设备列表
- `GET /api/device/:id` - 获取设备详情
- `POST /api/device` - 添加设备
- `PUT /api/device/:id` - 更新设备
- `DELETE /api/device/:id` - 删除设备
- `POST /api/device/:id/control` - 控制设备

### 用户认证

- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/user` - 获取用户信息

## 工具函数

### 时间处理

- `formatDate()` - 格式化日期时间
- `getRelativeTime()` - 获取相对时间描述

### 性能优化

- `debounce()` - 防抖函数
- `throttle()` - 节流函数

### 数据处理

- `deepClone()` - 深拷贝
- `generateUUID()` - 生成UUID
- `formatNumber()` - 数字格式化

### 存储管理

- `storage.set()` - 设置存储
- `storage.get()` - 获取存储
- `storage.remove()` - 删除存储
- `storage.clear()` - 清空存储

## 状态管理

使用Vue 3的Reactive API进行状态管理：

- `user` - 用户信息
- `settings` - 应用设置
- `devices` - 设备列表
- `sensorData` - 传感器数据

## 部署说明

### H5部署

1. 执行 `pnpm run build:h5`
2. 将dist目录下的文件部署到Web服务器

### 小程序部署

1. 执行 `pnpm run build:mp-weixin`
2. 使用微信开发者工具打开dist/build/mp-weixin目录
3. 上传小程序包

### 后端部署

1. 配置环境变量
2. 执行 `npm install --production`
3. 使用PM2等工具启动服务

## 开发规范

### 代码规范

- 使用ES6+语法
- 遵循Vue 3组合式API规范
- 统一的文件命名规范
- 详细的注释说明

### 样式规范

- 使用rpx单位适配多端
- 组件样式隔离 (scoped)
- 颜色和尺寸统一定义

### 接口规范

- RESTful API设计
- 统一的响应格式
- 错误码规范化

## 后续开发计划

- [ ] 用户登录认证
- [ ] 数据可视化图表
- [ ] 消息推送功能
- [ ] 离线数据缓存
- [ ] 多语言支持
- [ ] 主题切换功能
- [ ] 单元测试覆盖

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交代码变更
4. 发起Pull Request

## 许可证

MIT License
