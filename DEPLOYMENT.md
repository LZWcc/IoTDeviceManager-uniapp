# 部署说明

## 目标

这个项目最适合用下面这套方式给老师查看：

- 前端：构建成 H5 静态页面
- 后端：Node.js + Express
- 数据库：MySQL
- WebSocket：跟后端走同一个域名和端口

这样老师只需要打开一个网址即可。

## 一、上线前先处理密钥

你当前本地 `backend/.env` 中包含真实数据库密码和 DeepSeek API Key，不要直接打包或上传。

建议先做这几件事：

1. 立刻轮换 `DEEPSEEK_API_KEY`
2. 把服务器上的配置写在 `backend/.env`
3. 前端只保留 `.env.example`，不要提交真实地址以外的敏感信息

## 二、前端环境变量

项目已经支持通过环境变量配置接口地址。

新建根目录 `.env.production`：

```env
VITE_API_BASE_URL=http://你的服务器IP:8081
VITE_WS_BASE_URL=ws://你的服务器IP:8081
```

如果你已经绑定域名并配置 HTTPS，则改成：

```env
VITE_API_BASE_URL=https://你的域名
VITE_WS_BASE_URL=wss://你的域名
```

## 三、后端环境变量

进入 `backend/` 后，复制模板：

```bash
cp .env.example .env
```

然后填写真实数据库和 AI 配置。

如果老师只需要查看基础功能，AI 功能可以暂时不演示，但后端保留 `DEEPSEEK_API_KEY` 会更稳妥。

## 四、服务器推荐方案

推荐一台最普通的 Linux 云服务器：

- Ubuntu 22.04
- 2 核 2G 即可
- 开放端口：`80`、`443`、`8081`

需要安装：

```bash
sudo apt update
sudo apt install -y nginx mysql-server
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

Node.js 建议用 20 LTS。

## 五、部署后端

```bash
cd backend
pnpm install
cp .env.example .env
```

填写 `.env` 后启动：

```bash
node src/index.js
```

更建议用 PM2 托管：

```bash
pnpm add -g pm2
pm2 start src/index.js --name iot-backend
pm2 save
pm2 startup
```

## 六、部署数据库

你现在用的是本地 MySQL，所以服务器上也要有同样的数据库结构和数据。

本地导出：

```bash
mysqldump -u root -p wusiqi > wusiqi.sql
```

服务器导入：

```bash
mysql -u root -p -e "CREATE DATABASE wusiqi DEFAULT CHARACTER SET utf8mb4;"
mysql -u root -p wusiqi < wusiqi.sql
```

然后把 `backend/.env` 里的数据库连接改成服务器的 MySQL 配置。

## 七、部署前端

在项目根目录执行：

```bash
pnpm install
pnpm build:h5
```

构建结果通常在 `dist/build/h5`。

把它复制到 Nginx 目录：

```bash
sudo mkdir -p /var/www/iot-device-manager
sudo cp -r dist/build/h5/* /var/www/iot-device-manager/
```

## 八、Nginx 示例

如果你先不配域名，只想让老师通过 IP 查看，可以用：

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/iot-device-manager;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

注意：你当前后端 WebSocket 不是单独的 `/ws` 路径，而是直接挂在同一个服务上。如果你后续走 Nginx 反代同域名，前端环境变量更推荐直接写域名根地址，而不是 `:8081`。

## 九、最省事的演示办法

如果你的目标只是“老师能打开看看”，优先级建议如下：

1. 买一台云服务器，部署 MySQL + backend + H5
2. 不做登录，不加复杂权限
3. 只开放只读查看能力
4. AI 功能可选，不稳定就隐藏入口

这是最稳、最像正式项目答辩环境的方案。

## 十、如果不想买服务器

你也可以用临时演示方案，但稳定性差一些：

- 前端部署到 Vercel / Netlify
- 后端部署到 Railway / Render
- 数据库放在云 MySQL

但你这个项目里还有本地数据库、WebSocket、可能还有 MQTT 依赖，所以整体上不如一台自己的 Linux 服务器省心。
