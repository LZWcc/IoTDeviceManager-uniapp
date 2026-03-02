import instance from "../request.js"

export async function getFormatAll() {
  try {
    const response = await instance.get("/api/format-limit-1")
    return response.data
  } catch (error) {
    console.error("获取数据失败:", error)
    throw error
  }
}
