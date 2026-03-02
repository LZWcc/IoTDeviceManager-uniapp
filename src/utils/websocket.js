/**
 * uni-app 兼容的 WebSocket 客户端
 * 支持 H5、小程序、App 多平台
 */
class WebSocketClient {
  constructor(url) {
    this.url = url
    this.socketTask = null // uni-app 的 SocketTask 对象
    this.isOpen = false // 连接是否真正建立
    this.pendingQueue = [] // 连接前的消息队列
    this.listeners = new Map()
    this.reconnectInterval = 3000 // 重连间隔时间，单位毫秒
    this.reconnectTimer = null // 重连定时器
    this.isManualClose = false // 是否手动关闭
    this.heartbeatTimer = null // 心跳定时器
    this.heartbeatInterval = 30000 // 心跳间隔 30 秒
  }

  connect() {
    if (this.socketTask) {
      console.log("WebSocket 已连接，无需重复连接")
      return
    }

    this.isManualClose = false

    // 使用 uni.connectSocket 创建连接
    this.socketTask = uni.connectSocket({
      url: this.url,
      success: () => {
        console.log("WebSocket 连接请求已发送")
      },
      fail: (error) => {
        console.error("WebSocket 连接失败:", error)
        this.socketTask = null
        this.reconnect()
      },
    })

    // 监听 WebSocket 打开
    this.socketTask.onOpen(() => {
      console.log("✅ WebSocket 连接已打开")
      this.isOpen = true
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }
      // 将队列中的消息依次发送
      while (this.pendingQueue.length > 0) {
        const pending = this.pendingQueue.shift()
        this._doSend(pending)
      }
      this.startHeartbeat()
    })

    // 监听 WebSocket 消息
    this.socketTask.onMessage((res) => {
      try {
        const message = JSON.parse(res.data)
        const { type, data } = message

        // 处理心跳响应
        if (type === "pong") {
          return
        }

        if (this.listeners.has(type)) {
          const callbacks = this.listeners.get(type)
          callbacks.forEach((cb) => cb(data))
        }
      } catch (error) {
        console.error("处理 WebSocket 消息时出错:", error)
      }
    })

    // 监听 WebSocket 关闭
    this.socketTask.onClose(() => {
      console.log("WebSocket 连接已关闭")
      this.socketTask = null
      this.isOpen = false
      this.stopHeartbeat()

      if (!this.isManualClose) {
        this.reconnect() // 非手动关闭时自动重连
      }
    })

    // 监听 WebSocket 错误
    this.socketTask.onError((error) => {
      console.error("❌ WebSocket 错误:", error)
      this.socketTask = null
      this.isOpen = false
      this.stopHeartbeat()
      if (!this.isManualClose) {
        this.reconnect()
      }
    })
  }

  /**
   * 订阅消息类型
   * @param {string} type 消息类型
   * @param {Function} callback 回调函数
   */
  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, [])
    }
    this.listeners.get(type).push(callback)
    console.log(`📬 已订阅消息类型: ${type}`)
  }

  /**
   * 取消订阅消息类型
   * @param {string} type 消息类型
   * @param {Function} callback 回调函数
   */
  off(type, callback) {
    if (!this.listeners.has(type)) return
    const callbacks = this.listeners.get(type)
    const index = callbacks.indexOf(callback)
    if (index !== -1) {
      callbacks.splice(index, 1)
      console.log(`📭 已取消订阅消息类型: ${type}`)
    }
  }

  /**
   * 发送消息
   * @param {Object} data 要发送的数据
   */
  send(data) {
    if (this.isOpen && this.socketTask) {
      this._doSend(data)
    } else {
      // 连接尚未建立，加入等待队列
      console.log("⏳ WebSocket 连接未就绪，消息加入队列:", data)
      this.pendingQueue.push(data)
    }
  }

  _doSend(data) {
    this.socketTask.send({
      data: JSON.stringify(data),
      success: () => {
        console.log("📤 消息发送成功:", data)
      },
      fail: (error) => {
        console.error("📤 消息发送失败:", error)
        // 发送失败重新入队
        this.pendingQueue.unshift(data)
      },
    })
  }

  /**
   * 自动重连
   */
  reconnect() {
    if (this.reconnectTimer || this.isManualClose) return

    this.reconnectTimer = setTimeout(() => {
      console.log("🔄 正在尝试重连 WebSocket...")
      this.connect()
      this.reconnectTimer = null
    }, this.reconnectInterval)
  }

  /**
   * 启动心跳
   */
  startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.socketTask) {
        this.send({ type: "ping" })
      }
    }, this.heartbeatInterval)
  }

  /**
   * 停止心跳
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 关闭连接
   */
  close() {
    this.isManualClose = true

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.stopHeartbeat()

    if (this.socketTask) {
      this.socketTask.close({
        success: () => {
          console.log("WebSocket 连接已主动关闭")
          this.socketTask = null
        },
        fail: (error) => {
          console.error("关闭 WebSocket 失败:", error)
          this.socketTask = null
        },
      })
    }
  }

  /**
   * 检查连接状态
   * @returns {boolean}
   */
  isConnected() {
    return this.isOpen && this.socketTask !== null
  }
}

// 创建全局 WebSocket 客户端实例
// 注意：需要根据实际后端地址修改
const wsClient = new WebSocketClient("ws://localhost:8081")

// 自动连接
wsClient.connect()

export default wsClient
