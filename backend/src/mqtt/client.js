import mqtt from 'mqtt'
import MQTT_CONFIG from '../config/mqtt.js'
import db from '../db.js'
import wsService from '../websocket/wsServer.js'

const deviceHeartbeats = new Map()
// 内存指令队列 Map<deviceId, Array<{ topic: string, message: string }>>
const offlineCommandQueues = new Map()
const tableMap = {
  sensor: { data: 't_sensor_data', mapper: 't_sensor_field_mapper' },
  behavior: { data: 't_behavior_data', mapper: 't_behavior_field_mapper' },
}

// 补零，保证时间字段为两位字符串。
function padTimeUnit(value) {
  return String(value).padStart(2, '0')
}

// 格式化服务端当前时间，供设备同步时间指令使用。
export function formatServerTime(date = new Date()) {
  const year = date.getFullYear()
  const month = padTimeUnit(date.getMonth() + 1)
  const day = padTimeUnit(date.getDate())
  const hour = padTimeUnit(date.getHours())
  const minute = padTimeUnit(date.getMinutes())
  const second = padTimeUnit(date.getSeconds())
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

// 构造全局同步时间指令的标准消息体。
export function buildGlobalSyncTimeCommand(date = new Date()) {
  return {
    d_no: 'GLOBAL',
    t_name: '同步时间',
    topic: 'sync_time',
    value: formatServerTime(date),
    timestamp: date.getTime(),
  }
}

class MQTTService {
  constructor() {
    this.disabled = process.env.MQTT_DISABLED === '1'
    if (this.disabled) {
      this.client = null
      return
    }
    this.client = mqtt.connect(`${MQTT_CONFIG.host}:${MQTT_CONFIG.port}`, {
      clientId: MQTT_CONFIG.clientId,
    })
    this.client.on('connect', () => {
      console.log('已连接到MQTT')
      this.subscribeTopics()
    })
    this.client.on('reconnect', () => console.log('reconnect...'))
    this.client.on('error', (error) => console.log('MQTT连接错误:', error))
    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message)
    })
    this.startOfflineCheck()
  }

  subscribeTopics() {
    // this.subscribe('device/+/behavior')
    // this.subscribe('device/+/sensor')
    // this.subscribe('device/+/error')
    // this.subscribe('device/+/direct')
    // this.subscribe('device/+/heartbeat')
    // this.subscribe('device/+/power_on') // 加入系统上电有关主题, 接收到主题信息时, 取服务器的时间new Date()同步下去(设备编号判断)
    // 订阅将设备编号通配符去掉的主题
    this.subscribe('device/behavior')
    this.subscribe('device/sensor')
    this.subscribe('device/error')
    this.subscribe('device/direct')
    this.subscribe('device/heartbeat')
    this.subscribe('device/power_on')
  }

  subscribe(topic) {
    if (this.disabled || !this.client) return
    this.client.subscribe(topic, (err) => {
      if (err) {
        console.log(`订阅主题 ${topic} 失败:`, err)
      } else {
        console.log(`已订阅主题: ${topic}`)
      }
    })
  }

  publish(topic, message) {
    if (this.disabled || !this.client) {
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      this.client.publish(topic, message, (err) => {
        if (err) {
          console.log(`发布消息到主题 ${topic} 失败:`, err)
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // 处理收到的消息
  handleMessage(topic, message) {
    // console.log(`处理消息 - 主题: ${topic}, 消息: ${message.toString()}`)
    try {
      const data = JSON.parse(message.toString())
      // const deviceId = topic.split('/')[1]
      const deviceId = data.d_no
      const type = topic.split('/')[1]
      if (!deviceId) {
        console.log('收到消息但无法解析设备ID，跳过处理')
        return
      }
      // console.log(`收到消息\n   设备 ID: ${deviceId}\n   主题: ${topic}\n   数据:`, data)
      if (tableMap[type]) {
        // sensor 或 behavior
        const config = tableMap[type]
        this.handleSensorOrBehaviorData(deviceId, data, config)
      } else if (type === 'error') {
        this.handleErrorData(deviceId, data)
      } else if (type === 'direct') {
        // console.log(`收到设备 ${deviceId} 的直接指令响应:`, data)
      } else if (type === 'heartbeat') {
        this.handleHeartbeat(deviceId)
        /*
        {
          d_no: 'device123',
          timestamp: new Date().toISOString(),
        }
        */ 
      } else {
        console.log(`未知的消息类型: ${type}`)
      }
    } catch (error) {
      console.error('处理消息失败:', error)
    }
  }

  // 处理Sensor或Behavior并存储到数据库
  async handleSensorOrBehaviorData(deviceId, data, tableConfig) {
    try {
      const mapper = await this.getFieldMapper(tableConfig.mapper)
      const mappedData = {}
      for (const [p_name, value] of Object.entries(data)) {
        const dbFieldName = mapper[p_name]
        if (dbFieldName) {
          mappedData[dbFieldName] = value
        }
      }
      await db.query(
        `INSERT INTO ${tableConfig.data}
      (d_no, field1, field2, field3, field4, field5, field6, field7, field8, field9, field10, c_time, online) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          deviceId,
          mappedData.field1 || null,
          mappedData.field2 || null,
          mappedData.field3 || null,
          mappedData.field4 || null,
          mappedData.field5 || new Date().toLocaleString().replace(/\//g, '-'),
          mappedData.field6 || null,
          mappedData.field7 || null,
          mappedData.field8 || null,
          mappedData.field9 || null,
          mappedData.field10 || null,
          data.online || '在线数据',
        ],
      )
      
      // 存入数据库后, 推送到WebSocket
      const type = tableConfig.data === 't_sensor_data' ? 'sensor' : 'behavior'
      wsService.sendToSubscribers(`${type}_update`, {
        d_no: deviceId,
        ...mappedData,
        timestamp: new Date(),
      })
    } catch (error) {
      console.error('存储传感器数据失败:', error)
    }
  }

  // 处理错误数据
  async handleErrorData(deviceId, data) {
    try {
      await db.query(
        `INSERT INTO t_error_msg (d_no, c_time, e_msg, e_no, type) VALUES (?, NOW(), ?, ?, ?)`,
        [deviceId, data.msg || '', data.code || null, data.type || null],
      )
      console.log(`✅ 错误数据已保存到 t_error_msg`)
      wsService.sendToSubscribers('error_update', {
        d_no: deviceId,
        c_time: new Date(),
        e_msg: data.msg || '',
        e_no: data.code || null,
        type: data.type || null,
      })
    } catch (error) {
      console.error('存储错误数据失败:', error)
    }
  }

  // 判断设备是否在线(发送指令前调用)
  isDeviceOnline(deviceId) {
    if (!deviceHeartbeats.has(deviceId)) return false
    const lastActive = deviceHeartbeats.get(deviceId)
    return Date.now() - lastActive < 5000 // 5秒内有心跳则视为在线
  }

  async sendGlobalCommand(command) {
    const message =
      typeof command === 'string' ? command : JSON.stringify(command)
    await this.publish('device/direct', message)
    console.log('✅ 全局指令已发布到 device/direct')
  }

  // 发送指令到设备(在线则直接发送，离线则入队列)
  async sendCommandToDevice(deviceId, topic, message) {
    if (deviceId === 'GLOBAL' || topic === 'device/direct') {
      await this.sendGlobalCommand(message)
      return
    }
    if (this.isDeviceOnline(deviceId)) {
      await this.publish(topic, message)
      await this.delay(200)
      await this.publish(topic, message)
      console.log(`✅ 指令已发送到在线设备 ${deviceId}`)
    } else {
      console.log(` 设备${deviceId} 离线，指令已入队列`)
      // 先判断 Map 里有没有这个设备的队列
      if (!offlineCommandQueues.has(deviceId)) {
        // 如果没有，才初始化为一个空数组 []
        offlineCommandQueues.set(deviceId, [])
      }
      // 获取这个数组，并向里面 push 新数据
      offlineCommandQueues.get(deviceId).push({ topic, message })
    }
  }

  async syncGlobalTime(date = new Date()) {
    const command = buildGlobalSyncTimeCommand(date)
    await this.sendGlobalCommand(command)
    return command
  }

  // 处理心跳数据
  async handleHeartbeat(deviceId) {
    deviceHeartbeats.set(deviceId, Date.now())
    // 发送 ACK 回应
    const ackTopic = `device/${deviceId}/heartbeat/ack`
    // const ackTopic = `device/heartbeat/ack`
    const ackMessage = JSON.stringify({ d_no: deviceId, msg: 'pong', timestamp: Date.now() })
    await this.publish(ackTopic, ackMessage)

    // 检查并发送所有缓存指令
    if (offlineCommandQueues.has(deviceId)) {
      const queue = offlineCommandQueues.get(deviceId)
      if (queue.length > 0) {
        console.log(`设备 ${deviceId} 已上线，发送缓存指令，共 ${queue.length} 条`)
        for (const { topic, message } of queue) {
          await this.publish(topic, message)
          await this.delay(200)
          await this.publish(topic, message)
          await this.delay(200)
        }
        // queue.forEach(({ topic, message }) => {
        //   this.publish(topic, message)
        // })
        // 清空队列
        offlineCommandQueues.set(deviceId, [])
      }
    }
  }

  // 定期检查离线
  startOfflineCheck() {
    setInterval(() => {
      const now = Date.now()
      const timeout = 5000 // 5秒无心跳视为离线
      deviceHeartbeats.forEach((lastHeartbeat, deviceId) => {
        if (now - lastHeartbeat > timeout) {
          console.log(`⚠️ 设备 ${deviceId} 已离线`)
        }
      })
    }, 2500)
  }

  /**
   * 获取字段映射关系
   * @param {'t_sensor_field_mapper' | 't_behavior_field_mapper'} tableName - 映射表名称
   * @returns {Promise<Object>} 返回 p_name 到 db_name 的映射对象
   */
  async getFieldMapper(tableName) {
    try {
      const [rows] = await db.query(
        `SELECT f_name, db_name, p_name, unit, visible FROM ${tableName} WHERE visible = ?`,
        [1],
      )
      const mapper = {}
      rows.forEach((row) => {
        mapper[row.p_name] = row.db_name
      })
      return mapper
    } catch (error) {
      console.error('获取传感器字段映射关系失败:', error)
    }
  }
}

const mqttService = new MQTTService()
export default mqttService
