import express from 'express'
import db from './db.js'
import moment from 'moment'

const router = express.Router()

router.get('/error', async (req, res) => {
  try {
    // 1. 从前端获取参数
    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.pageSize) || 10
    const offset = (page - 1) * pageSize

    const { d_no, startTime, endTime } = req.query
    // 2 构建筛选条件
    let filter = `
      WHERE 1=1
      ${d_no ? ' AND d_no = ?' : ''}
      ${startTime && endTime ? ' AND c_time BETWEEN ? AND ?' : ''}
      `
    const params = [...(d_no ? [d_no] : []), ...(startTime && endTime ? [startTime, endTime] : [])]
    // 3. 查询总条数
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM t_error_msg ${filter}`,
      params,
    )
    // 4. 查询当前页数据
    const [dataRows] = await db.query(
      `
      SELECT d_no, e_msg, type, c_time
      FROM t_error_msg
      ${filter}
      ORDER BY c_time DESC 
      LIMIT ? OFFSET ?
    `,
      [...params, pageSize, offset],
    )
    // 5. 格式化输出
    const formatted = dataRows.map((row) => ({
      d_no: row.d_no || '-',
      e_msg: row.e_msg || '无错误信息',
      type: row.type || null,
      type_name: row.type === '1' ? '告警' : row.type === '2' ? '错误' : '正常',
      c_time: moment(row.c_time).format('YYYY-MM-DD HH:mm:ss')
    }))
    // 6. 返回分页结果
    res.json({
      total,
      data: formatted,
      page,
      pageSize,
    })
  } catch (error) {
    console.log(error.message)
  }
})

export default router