import { API_BASE_URL } from "@/config/runtime"

export const BASE_URL = API_BASE_URL

const timeout = 20000

const instance = (options) => {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      url: `${BASE_URL}${options.url}`,
      method: options.method || "GET",
      data: options.data || options.params || {},
      timeout,
      header: options.header || options.headers || {
        "Content-Type": "application/json",
      },
      success(res) {
        const response = {
          data: res.data,
          status: res.statusCode,
          headers: res.header,
          config: options,
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(response)
          return
        }

        const error = new Error(res.data?.msg || res.errMsg || "请求失败")
        error.response = response
        reject(error)
      },
      fail(err) {
        reject(err)
      },
    }

    uni.request(requestOptions)
  })
}

instance.get = (url, config) => instance({ ...config, url, method: "GET" })
instance.post = (url, data, config) =>
  instance({ ...config, url, data, method: "POST" })
instance.put = (url, data, config) =>
  instance({ ...config, url, data, method: "PUT" })
instance.delete = (url, config) =>
  instance({ ...config, url, method: "DELETE" })

export default instance
