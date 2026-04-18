# 每日记账

每日记账系统，支持 Web 端使用和 Android APK 打包。

## 功能

- 用户登录与 JWT 鉴权
- 账单流水分页查询
- 新增、编辑、删除账单
- 记账类型管理
- 超级管理员用户管理
- 流水导出与汇总导出
- Docker 部署
- Android APK 打包

## 技术栈

- 后端：Node.js、Express、Sequelize、MySQL
- 前端：React、Vite、Ant Design
- 容器：Docker、Docker Compose
- Android 打包：Capacitor

## 项目结构

```text
daily-bill/
├─ backend/                后端服务
├─ frontend/               前端项目
├─ docker-compose.yml      容器部署配置
├─ .env.example            环境变量示例
└─ README.md
```

## 环境变量

项目运行时使用根目录 `.env.example` 中的配置项。

示例：

```env
PORT=13101
DB_HOST=your-db-host
DB_PORT=3306
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
JWT_SECRET=replace-with-a-random-secret
SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_PASSWORD=admin123456
CORS_ORIGIN=http://localhost:15172
```

说明：

- `PORT`：后端服务端口
- `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`：数据库连接信息
- `JWT_SECRET`：JWT 签名密钥，生产环境必须替换
- `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD`：初始化超级管理员账号
- `CORS_ORIGIN`：允许访问后端的前端地址

## 本地开发

### 启动后端

```powershell
cd backend
npm install
npm run dev
```

默认地址：

```text
http://localhost:13101
```

健康检查：

```text
http://localhost:13101/api/health
```

### 启动前端

```powershell
cd frontend
npm install
npm run dev
```

默认地址：

```text
http://localhost:15172
```

开发模式下，Vite 会将 `/api` 代理到：

```text
http://localhost:13101
```

## Docker 部署

### 启动

```powershell
docker compose pull
docker compose up -d
```

强制更新：

```powershell
docker compose down
docker compose pull
docker compose up -d
```

### 访问地址

- 前端服务地址：`http://localhost:15172`
- 后端服务地址：`http://localhost:13101`
- 健康检查：`http://localhost:13101/api/health`

### 注意事项

- Docker Compose 不会自动安装数据库
- 项目默认连接你已准备好的外部数据库
- 前端容器通过 Nginx 反向代理 `/api` 到后端容器

## 镜像发布

如果需要自行构建并发布镜像，请将以下镜像名替换为你自己的仓库地址：

```powershell
docker build -t your-registry/daily-bill-backend:latest ./backend
docker build -t your-registry/daily-bill-frontend:latest ./frontend
docker push your-registry/daily-bill-backend:latest
docker push your-registry/daily-bill-frontend:latest
```

建议使用明确版本号，而不是长期使用 `latest`：

```powershell
docker build -t your-registry/daily-bill-backend:v1 ./backend
docker build -t your-registry/daily-bill-frontend:v1 ./frontend
docker push your-registry/daily-bill-backend:v1
docker push your-registry/daily-bill-frontend:v1
```

## Android APK 打包

### 环境要求

- Node.js
- JDK 21+
- Android Studio
- Android SDK

### 命令行打包

调试包：

```powershell
cd frontend
npm install
npm run apk:debug
```

发布包：

```powershell
cd frontend
npm run apk:release
```

### Windows 脚本

可直接双击：

- `frontend/build-apk-debug.bat`
- `frontend/build-apk-release.bat`

### APK 接口地址

- Android 模拟器默认地址：`http://10.0.2.2:13101/api`
- 真机调试请填写真实的后端服务地址，例如：`https://your-api-domain/api`

### 输出路径

- `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
- `frontend/android/app/build/outputs/apk/release/每日记账.apk`

## 默认账号

系统启动时会自动确保超级管理员存在，取值来自环境变量：

- 用户名：`SUPER_ADMIN_USERNAME`
- 密码：`SUPER_ADMIN_PASSWORD`

## 常见问题

### 登录失败或返回 502

通常是前端代理地址、后端端口或容器版本不一致导致。

排查命令：

```powershell
docker compose logs --tail=50 frontend
docker compose logs --tail=50 backend
```

### 后端提示 `Missing environment variable`

说明环境变量缺失，或对应值为空。

### 已推送新镜像，但服务器仍然是旧版本

建议执行：

```powershell
docker compose down
docker compose pull
docker compose up -d
```

如果仍有缓存问题，改用明确版本号，不要长期依赖 `latest`。

## 安全建议

- 不要在文档或仓库中写入真实数据库地址、账号和密码
- 不要提交真实的 `JWT_SECRET`
- 生产环境建议通过独立环境变量或部署平台注入配置
