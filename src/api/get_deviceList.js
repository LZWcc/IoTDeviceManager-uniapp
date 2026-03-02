import instance from "./request.js"

export async function getDeviceList(type = "sensor") {
  try {
    const response = await instance.get("/api/device-list", {
      params: { type },
    })
    return response.data
  } catch (error) {
    console.error("获取数据失败:", error)
    throw error
  }
}
