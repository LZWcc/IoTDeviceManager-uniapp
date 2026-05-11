import mqtt from 'mqtt'
import MQTT_CONFIG from '../config/mqtt.js'
import axios from 'axios'

const API_BASE_URL = 'http://localhost:8081/api/get-devices'

async function init() {
  try {
    const response = await axios.get(API_BASE_URL)
    const devices = response.data
    if (devices.length === 0) {
      console.log('没有设备可模拟，退出。')
      return
    }
    console.log(`✅ 获取到 ${devices.length} 个设备: ${devices.join(', ')}`)
    devices.forEach((deviceId) => {
      startDeviceSimulator(deviceId)
    })
    startDeviceSimulator('GLOBAL')

  } catch (error) {
    console.error('获取设备列表失败:', error)
    return
  }
}

// 单个设备的模拟器
function startDeviceSimulator(deviceId) {
  const clientId = `device_${deviceId}_simulator`
  const client = mqtt.connect(`${MQTT_CONFIG.host}:${MQTT_CONFIG.port}`, {
    clientId,
  })
  client.on('connect', () => {
    console.log(`模拟设备已启动, Id: ${deviceId}`)
    // 订阅心跳确认主题
    const ackTopic = `device/${deviceId}/heartbeat/ack`
    client.subscribe(ackTopic)
    // 订阅指令主题
    const directTopic = `device/${deviceId}/direct`
    const directTopicWithGlobal = `device/direct`
    client.subscribe(directTopic)
    client.subscribe(directTopicWithGlobal)

    sendHeartbeat(client, deviceId)
  })
  client.on('message', (topic, message) => {
    const msgStr = message.toString()
    // console.log(`设备 ${deviceId} 收到消息 - 主题: ${topic}, 消息: ${msgStr}`)
    const data = JSON.parse(msgStr)
    const receivedDeviceId = data.d_no
    const isHeartbeatAck = topic === `device/${deviceId}/heartbeat/ack`

    if (topic === 'device/direct' && data.topic === 'sync_time') {
      console.log(`[SYNC_TIME] 设备 ${deviceId} 收到全局同步时间: ${data.value}`)
      return
    }

    if ((receivedDeviceId === deviceId || deviceId === 'GLOBAL') && !isHeartbeatAck) {
      // 原日志保留如下；之前因为 heartbeat ack 主题判断不准确，会持续刷屏。
      // console.log(`设备 ${deviceId} 收到消息 - 主题: ${topic}, 来自设备: ${receivedDeviceId}, 消息: ${msgStr}`, '51')
      console.log(`设备 ${deviceId} 收到消息 - 主题: ${topic}, 来自设备: ${receivedDeviceId}, 消息: ${msgStr}`)
    }
  })
  client.on('error', (error) => {
    console.log(`设备 ${deviceId} MQTT连接错误:`, error)
  })
}

function sendHeartbeat(client, deviceId) {
  const randomDelay = Math.floor(Math.random() * 3000) // 0-3000ms 随机延迟
  setTimeout(() => {
    setInterval(() => {
      // const heartbeatTopic = `device/${deviceId}/heartbeat`
      const heartbeatTopic = `device/heartbeat`
      const heartbeatMessage = JSON.stringify({
        d_no: deviceId,
        timestamp: Date.now(),
      })
      client.publish(heartbeatTopic, heartbeatMessage, (err) => {
        if (err) {
          console.log(`设备 ${deviceId} 发送心跳失败:`, err)
        } else {
          // console.log(`设备 ${deviceId} 已发送心跳`)
        }
      })
    }, 5000)
  }, randomDelay)
}
// const client = mqtt.connect(`${MQTT_CONFIG.host}:${MQTT_CONFIG.port}`, {
//   clientId: 'device_2021_simulator',
// })

// client.on('connect', () => {
//   console.log("模拟设备已启动, Id: device_2021_simulator")
//   const ackTopic = 'device/2021/heartbeat/ack'
//   client.subscribe(ackTopic, (err) => {
//     if (!err) {
//       console.log(`已订阅心跳确认主题: ${ackTopic}`)
//       sendHeartbeat()
//     }
//   })
// })

// function sendHeartbeat() {
//   setInterval(() => {
//     const heartbeatTopic = 'device/2021/heartbeat'
//     const heartbeatMessage = JSON.stringify({
//       d_no: '2021',
//       timestamp: Date.now(),
//     })
//     client.publish(heartbeatTopic, heartbeatMessage, (err) => {
//       if (err) {
//         console.log('发送心跳失败:', err)
//       } else {
//         console.log('已发送心跳')
//       }
//     })
//   }, 3000)
// }

init()
