# Bill

每日记账系统，支持 Web 端和 Android APK 打包。

## 功能

- 用户登录与 JWT 鉴权
- 个人账单流水倒序分页查看
- 新增、编辑、删除账单
- 账单字段：日期、记账类型、金额、备注
- 金额仅允许数字输入，单位为元
- 导出流水报表
- 导出汇总报表
  - 横向为记账类型
  - 纵向为日期
  - 包含行合计、列合计、总合计
- 记账类型配置
- 超级管理员用户管理
  - 创建用户
  - 禁用用户
  - 删除用户
- 每个用户的数据独立隔离
- 支持 Docker 部署
- 支持前端打包 Android APK

## 技术栈

- 后端：Node.js、Express、Sequelize、MySQL
- 前端：React、Vite、Ant Design
- 容器：Docker、Docker Compose
- Android 打包：Capacitor

## 项目结构

```text
daily-bill/
├─ backend/                 后端服务
├─ frontend/                前端项目
├─ docker-compose.yml       容器部署配置
├─ .env.example             运行配置文件
└─ README.md
```

## 配置文件

当前项目运行时只使用根目录 `.env.example`。

示例：

```env
PORT=13101
DB_HOST=your-mysql-host
DB_PORT=21306
DB_NAME=daily_bill
DB_USER=root
DB_PASSWORD=your-db-password
JWT_SECRET=replace-with-a-random-secret
SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_PASSWORD=admin123456
CORS_ORIGIN=http://localhost:15172
```

说明：

- `PORT`：后端服务端口，当前默认 `13101`
- `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`：外部 MySQL 连接信息
- `JWT_SECRET`：JWT 签名密钥，必须改成随机字符串
- `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD`：系统启动时自动初始化的超级管理员账户
- `CORS_ORIGIN`：允许访问后端的前端地址

## 本地开发

### 启动后端

```powershell
cd backend
npm install
npm run dev
```

后端默认访问地址：

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

前端开发地址：

```text
http://localhost:5173
```

开发模式下，Vite 会将 `/api` 代理到：

```text
http://localhost:13101
```

## Docker 部署

### 当前镜像

`docker-compose.yml` 当前使用远程镜像：

- `wangjinjing/daily-bill-backend:latest`
- `wangjinjing/daily-bill-frontend:latest`

### 启动

```powershell
docker compose pull
docker compose up -d
```

如需强制更新：

```powershell
docker compose down
docker compose pull
docker compose up -d
```

### 容器访问地址

- 前端：http://localhost:15172
- 后端：http://localhost:13101
- 健康检查：http://localhost:13101/api/health

### 注意

- Docker Compose 不会安装 MySQL
- 项目默认连接你已有的外部 MySQL
- 前端容器通过 Nginx 反向代理 `/api` 到后端容器

## 镜像发布

如果你要重新发布最新镜像到 Docker Hub，可以在项目根目录执行：

```powershell
docker build -t wangjinjing/daily-bill-backend:latest ./backend
docker build -t wangjinjing/daily-bill-frontend:latest ./frontend
docker push wangjinjing/daily-bill-backend:latest
docker push wangjinjing/daily-bill-frontend:latest
```

更稳妥的做法是使用明确版本号，例如：

```powershell
docker build -t wangjinjing/daily-bill-backend:v2 ./backend
docker build -t wangjinjing/daily-bill-frontend:v2 ./frontend
docker push wangjinjing/daily-bill-backend:v2
docker push wangjinjing/daily-bill-frontend:v2
```

## Android APK 打包

### 环境要求

- Node.js
- JDK 17+
- Android Studio
- Android SDK

### 命令行打包

```powershell
cd frontend
npm install
npm run apk:debug
```

发布版：

```powershell
cd frontend
npm run apk:release
```

### Windows 双击脚本

可直接双击：

- `frontend/build-apk-debug.bat`
- `frontend/build-apk-release.bat`

### APK 默认接口地址

- Android 模拟器默认使用：`http://10.0.2.2:13101/api`
- 真机调试请改成你电脑局域网 IP，例如：`http://192.168.1.10:13101/api`

### 输出路径

- `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
- `frontend/android/app/build/outputs/apk/release/app-release.apk`

## 默认账号

系统启动时会自动确保超级管理员存在。

默认取值来自配置文件：

- 用户名：`SUPER_ADMIN_USERNAME`
- 密码：`SUPER_ADMIN_PASSWORD`

## 常见问题

### 登录返回 502

通常是前端容器代理的后端端口不对，或者镜像还是旧版本。

排查命令：

```powershell
docker compose logs --tail=50 frontend
docker compose logs --tail=50 backend
```

### 后端提示 `Missing environment variable`

说明根目录 `.env.example` 缺少对应配置项，或者值为空。

### Docker Hub 已推送，但服务器还是旧版本

建议：

```powershell
docker compose down
docker compose pull
docker compose up -d
```

如果仍有缓存问题，改用明确版本号，不要长期依赖 `latest`。

## 安全建议

- 不要把真实数据库密码和正式 `JWT_SECRET` 提交到公开仓库
- `JWT_SECRET` 必须替换成随机高强度字符串
- 生产环境建议使用专门的部署配置文件或环境变量注入
