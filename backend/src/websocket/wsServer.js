import { WebSocketServer } from 'ws'
import { WS_CONFIG } from '../config/ws.js'

// const app = express();
// const server = http.createServer(app);
// console.log(server)

class WSService {
  constructor() {
    this.wss = null
    this.clients = new Set()
  }
  init(server) {
    this.wss = new WebSocketServer({ server })
    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress // 获取客户端IP地址
      console.log(`新的WebSocket连接 [${clientIp}]`)
      this.clients.add(ws)
      ws.subscriptions = [] // 客户端订阅的主题列表

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message)
          this.handleClientMessage(ws, data)
        } catch (error) {
          console.error('处理客户端消息时出错:', error)
        }
      })

      ws.on('close', () => {
        console.log('WebSocket连接关闭')
        this.clients.delete(ws)
      })

      ws.on('error', (error) => {
        console.error(`WebSocket错误 [${clientIp}]:`, error)
        this.clients.delete(ws)
      })
    })
    console.log('WebSocket服务器已启动，等待客户端连接...')
  }

  // 处理客户端消息
  handleClientMessage(ws, data) {
    const { type, topics } = data
    switch (type) {
      case 'subscribe':
        ws.subscriptions = topics || []
        console.log(`客户端订阅了主题: ${ws.subscriptions.join(', ')}`)
        break
      case 'unsubscribe':
        ws.subscriptions = []
        console.log('客户端取消了所有订阅')
        break
      default:
        console.log('未知消息类型:', type)
    }
  }

  sendToSubscribers(topic, data) {
    const message = JSON.stringify({
      type: topic,
      data,
      timestamp: Date.now(),
    })
    let count = 0
    // console.log(topic, data, message)
    this.clients.forEach((client) => {
      if (client.subscriptions.includes(topic) && client.readyState === WebSocket.OPEN) {
        client.send(message)
        count++
      }
    })
    console.log(`📤 已推送 [${topic}] 消息给 ${count} 个客户端`)
  }

  close() {
    if (this.wss) {
      this.wss.close(() => {
        console.log('WebSocket 服务器已关闭')
      })
    }
  }
}

const wsService = new WSService()
export default wsService