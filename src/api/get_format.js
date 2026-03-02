import instance from "../request.js"

export async function getFormat() {
  try {
    const response = await instance.get("/api/format")
    console.log("格式化后的传感器数据:", response.data)
    return response.data
  } catch (error) {
    console.error("获取数据失败:", error)
    throw error
  }
}
