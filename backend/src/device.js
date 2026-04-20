import express from 'express'
import db from './db.js'
import moment from 'moment'

const router = express.Router()

const sql = 'id, number, device_name, remarks, ctime'

function validateDeviceData(device_name, number, remarks, isNumberRequired = false) {
  const errors = []

  // 验证设备名称
  if (!device_name || typeof device_name !== 'string') {
    errors.push('设备名称不能为空')
  } else if (device_name.trim().length < 2 || device_name.trim().length > 50) {
    errors.push('设备名称长度必须在 2 到 50 个字符之间')
  }

  // 验证设备编号
  if (isNumberRequired) {
    // 如果必填，验证不能为空
    if (!number || typeof number !== 'string') {
      errors.push('设备编号不能为空')
    } else if (!/^[A-Za-z0-9_-]+$/.test(number)) {
      errors.push('设备编号只能包含字母、数字、下划线和连字符')
    } else if (number.length < 3 || number.length > 20) {
      errors.push('设备编号长度必须在 3 到 20 个字符之间')
    }
  } else {
    // 如果可选，只在有值时验证格式
    if (number && number.trim()) {
      if (!/^[A-Za-z0-9_-]+$/.test(number)) {
        errors.push('设备编号只能包含字母、数字、下划线和连字符')
      } else if (number.length < 3 || number.length > 20) {
        errors.push('设备编号长度必须在 3 到 20 个字符之间')
      }
    }
  }

  // 验证备注长度
  if (remarks && typeof remarks === 'string' && remarks.length > 200) {
    errors.push('备注不能超过 200 个字符')
  }

  return errors
}

// 获取设备
router.get('/device', async (req, res) => {
  try {
    const { keyword = '' } = req.query
    const searchPattern = `%${keyword}%`
    const [dataRows] = await db.query(
      `SELECT ${sql} FROM t_device WHERE device_name LIKE ? OR number LIKE ? ORDER BY number`,
      [searchPattern, searchPattern],
    )
    const formattedRows = dataRows.map((row) => {
      return { ...row, ctime: row.ctime ? moment(row.ctime).format('YYYY-MM-DD HH:mm:ss') : null }
    })
    console.log(formattedRows)
    res.json(formattedRows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 1, msg: '服务器错误' })
  }
})

// 删除设备
router.delete('/device/:id', async (req, res) => {
  try {
    const { id } = req.params
    const [result] = await db.query('DELETE FROM t_device WHERE id = ?', [id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 1, msg: '未找到该设备' })
    }
    res.json({
      code: 0,
      msg: '删除成功',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 1, msg: '服务器错误' })
  }
})

// 新增设备
router.post('/device', async (req, res) => {
  try {
    let { device_name, remarks, number } = req.body
    if (!number || !number.trim()) number = null
    // 数据验证
    const errors = validateDeviceData(device_name, number, remarks, false)
    if (errors.length > 0) {
      return res.status(400).json({ code: 1, msg: errors.join('; ') })
    }
    if (number) {
      const [[existingDevice]] = await db.query('SELECT id FROM t_device WHERE number = ?', [
        number,
      ])
      if (existingDevice) {
        return res.status(400).json({ code: 1, msg: '设备编号已存在' })
      }
    }

    const createTime = moment().format('YYYY-MM-DD HH:mm:ss')
    await db.query(
      'INSERT INTO t_device (device_name, remarks, ctime, number) VALUES (?, ?, ?, ?)',
      [device_name.trim(), remarks?.trim() || '', createTime, number ? number.trim() : null],
    )
    res.json({ code: 0, msg: '新增成功' })
  } catch (err) {
    console.error('新增设备失败:', err)
    res.status(500).json({ code: 1, msg: '服务器错误' })
  }
})

// 编辑设备
router.put('/device/:id', async (req, res) => {
  try {
    const { id } = req.params
    let { device_name, remarks, number } = req.body
    if (!number || !number.trim()) number = null
    // 数据验证
    const errors = validateDeviceData(device_name, number, remarks, false)
    if (errors.length > 0) {
      return res.status(400).json({ code: 1, msg: errors.join('; ') })
    }

    if (number) {
      const [[existingDevice]] = await db.query(
        'SELECT id FROM t_device WHERE number = ? AND id != ?',
        [number, id],
      )

      if (existingDevice) {
        return res.status(400).json({ code: 1, msg: '设备编号已存在' })
      }
    }

    const [result] = await db.query(
      'UPDATE t_device SET device_name = ?, remarks = ?, number = ? WHERE id = ?',
      [device_name.trim(), remarks?.trim() || '', number ? number.trim() : null, id],
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 1, msg: '未找到该设备' })
    }
    res.json({
      code: 0,
      msg: '编辑成功',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 1, msg: '服务器错误' })
  }
})

export default router
