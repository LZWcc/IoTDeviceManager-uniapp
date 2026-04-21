import express from 'express'
import db from '../db.js'
import mqttService, { buildGlobalSyncTimeCommand } from '../mqtt/client.js'

const router = express.Router()

const buildTree = (items) => {
  const map = {}
  items.forEach((item) => {
    map[item.id] = { ...item, children: [] }
  })
  const tree = []
  items.forEach((item) => {
    const node = map[item.id]
    // 如果父节点存在
    if (map[item.ref_id]) {
      // item.ref_id 当前节点的父节点 id
      map[item.ref_id].children.push(node) // 当前节点应该挂载在父节点的 children 数组下
    } else {
      // 父节点不存在, 说明是顶层节点, 直接 push
      tree.push(node)
    }
  })
  return tree
}

let sql = `SELECT id, ref_id, ref_value, t_name, f_type, f_value, max, min, \`order\`, mode FROM t_direct_config ORDER BY \`order\` DESC`
router.get('/get-direct-config', async (req, res) => {
  try {
    const [rows] = await db.query(`${sql}`)

    // 获取用户已保存的配置值
    const { d_no = 'GLOBAL' } = req.query
    const [userConfigs] = await db.query('SELECT config_id, value FROM t_direct WHERE d_no = ?', [
      d_no,
    ])
    const userConfigMap = {}
    userConfigs.forEach((item) => {
      userConfigMap[item.config_id] = item.value
    })

    // console.log('用户配置映射:', userConfigMap)

    // 格式化 f_value 字段
    const formatted = rows.map((row) => {
      if (row.f_value && typeof row.f_value === 'string') {
        const options = row.f_value.split('|').map((opt) => {
          const [label, value] = opt.split(':')
          return { label, value }
        })
        return { ...row, f_value: options, value: userConfigMap[row.id] || null }
      }
      return { ...row, f_value: null, value: userConfigMap[row.id] || null }
    })

    // 建立 id -> item 映射表
    // const map = {}
    // formatted.forEach((item) => {
    //   map[item.id] = { ...item, children: [] }
    // })

    // 构建树状结构
    const tree = buildTree(formatted)
    res.json(tree)
  } catch (error) {
    console.log(error.message)
  }
})

// 保存 / 更新配置接口
router.post('/save-config', async (req, res) => {
  try {
    const { configs, d_no = 'GLOBAL' } = req.body
    // console.log('接收到的数据:', { configs, d_no })
    // 获取数据库连接
    const connection = await db.getConnection()
    await connection.beginTransaction()
    // 这里的 messagesToSend 用于存储所有需要发送的 MQTT 消息
    // 确保先存入数据库成功之后再发送 MQTT 消息
    const messagesToSend = []
    try {
      for (const config of configs) {
        const [existing] = await connection.query(
          'SELECT id FROM t_direct WHERE config_id = ? AND d_no = ?',
          [config.id, d_no],
        )
        if (existing.length > 0) {
          await connection.query('UPDATE t_direct SET value = ? WHERE config_id = ? AND d_no = ?', [
            config.value,
            config.id,
            d_no,
          ])
          // console.log(`更新配置: id=${config.id}, value=${config.value}`)
        } else {
          await connection.query('INSERT INTO t_direct (config_id, value, d_no) VALUES (?, ?, ?)', [
            config.id,
            config.value,
            d_no,
          ])
          // console.log(`插入配置: id=${config.id}, value=${config.value}`)
        }
        // 发送 MQTT 指令
        const [rows] = await connection.query(
          `SELECT t_name, topic, preffix FROM t_direct_config WHERE id = ?`,
          [config.id],
        )
        if (rows.length === 0) {
          throw new Error(`配置项不存在: id=${config.id}`)
        }
        const { t_name, topic, preffix } = rows[0]
        if (topic) {
          const msg = {
            d_no,
            t_name,
            topic,
            value: preffix ? `${preffix}${config.value}` : config.value,
          }
          const pubTopic = d_no === 'GLOBAL' ? 'device/direct' : `device/${d_no}/direct`
          messagesToSend.push({
            d_no,
            topic: pubTopic,
            message: JSON.stringify(msg),
          })
        }
      }
      await connection.commit()
      connection.release()
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      for (const { d_no: targetDeviceNo, topic, message } of messagesToSend) {
        if (targetDeviceNo === 'GLOBAL') {
          await mqttService.sendGlobalCommand(message)
        } else {
          await mqttService.sendCommandToDevice(targetDeviceNo, topic, message)
        }
        await delay(50)
      }
      // messagesToSend.forEach(({ topic, message }) => {
      //   // mqttService.publish(topic, message)
      //   mqttService.sendCommandToDevice(d_no, topic, message)
      // })
      res.json({ code: 0, message: '保存成功' })
    } catch (error) {
      await connection.rollback()
      connection.release()
      console.log(error.message)
      res.status(500).json({
        code: 1,
        message: '保存失败',
        error: error.message,
      })
    }
  } catch (error) {
    console.log('保存失败', error)
    res.status(500).json({
      code: 1,
      message: '保存失败',
      error: error.message,
    })
  }
})

router.post('/sync-global-time', async (_req, res) => {
  try {
    const command = buildGlobalSyncTimeCommand()
    await mqttService.sendGlobalCommand(command)
    res.json({
      code: 0,
      message: '全局时间同步指令已下发',
      data: command,
    })
  } catch (error) {
    console.error('全局同步时间失败:', error)
    res.status(500).json({
      code: 1,
      message: '全局同步时间失败',
      error: error.message,
    })
  }
})

// 获取设备列表接口
router.get('/get-devices', async (req, res) => {
  try {
    const [devices] = await db.query(
      'SELECT DISTINCT number FROM t_device WHERE number != ? ORDER BY number',
      ['GLOBAL'],
    )

    // console.log('设备列表:', devices)
    res.json(devices.map((d) => d.number))
  } catch (error) {
    console.error('获取设备列表失败:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
