const BASE_URL = 'http://localhost:8081';
const timeout = 20000

const instance = (options) => {
  return new Promise((resolve, reject) => {
    // 请求拦截器逻辑
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || options.params || {},
      timeout: timeout,
      headers: options.headers || { 'Content-Type': 'application/json' },
      success(res) {
        // 响应拦截器逻辑 - 返回类似axios的response对象
        resolve({
          data: res.data,
          status: res.statusCode,
          headers: res.header,
          config: options
        })
      },
      fail(err) {
        reject(err)
      },
    })
  })
}

instance.get = (url, config) => instance({ ...config, url, method: 'GET' })
instance.post = (url, data, config) => instance({ ...config, url, data, method: 'POST' })
instance.put = (url, data, config) => instance({ ...config, url, data, method: 'PUT' })
instance.delete = (url, config) => instance({ ...config, url, method: 'DELETE' })

export default instance;