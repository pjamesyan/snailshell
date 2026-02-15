# 🐌 SnailShell

Web3 多身份账号管理工具 — 安全管理你的链上身份、项目注册、交易所账户。

## ✨ 功能

- **身份管理** — 多身份切换，每个身份独立的社交账号、钱包地址、KYC 资料
- **项目库** — 记录参与的 Web3 项目，跟踪阶段、投入、收益
- **交易所管理** — 管理多个交易所账户，资产记录，充值地址
- **数据安全** — AES-256-GCM 加密敏感数据，bcrypt 密码哈希，2FA 双因素认证
- **导入导出** — JSON / CSV 导出，支持加密导出，数据库备份恢复
- **局域网访问** — 一台电脑运行，其他设备浏览器访问
- **深色主题** — 护眼深蓝色界面

## 📸 截图

> 欢迎提交截图 PR

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) v22 或更高版本

### 安装

```bash
# 克隆仓库
git clone https://github.com/pjamesyan/snailshell.git
cd snailshell

# 安装依赖
npm install

# 构建前端
cd client
npm install
npx vite build
cd ..

# 启动
node server/index.js
```

浏览器打开 http://localhost:3001

### Windows 用户

双击 `start.bat` 即可启动。

### 局域网访问

启动后，同一网络下的其他设备可以通过 `http://你的IP:3001` 访问。

## 🔒 安全特性

| 特性 | 说明 |
|------|------|
| 密码存储 | bcrypt 哈希（cost=10） |
| 数据加密 | AES-256-GCM，密钥由 PBKDF2 派生 |
| PBKDF2 | 600,000 次迭代 + SHA-512 |
| 2FA | TOTP 双因素认证，密钥加密存储 |
| 登录保护 | 5 次失败锁定 15 分钟 |
| 密码强度 | 至少 8 位，含大小写字母和数字 |

所有敏感数据（邮箱、密码提示、钱包地址、API 备注等）均加密存储，数据库文件即使被盗也无法直接读取。

## 📁 项目结构

```
snailshell/
├── server/          # 后端 (Express + node:sqlite)
│   ├── index.js     # 入口
│   ├── db.js        # 数据库初始化 + 迁移
│   ├── crypto.js    # 加密工具
│   └── routes/      # API 路由
├── client/          # 前端源码 (React + Vite + Tailwind)
│   └── src/
├── public/          # 前端构建输出
├── data/            # 数据目录（自动创建，不要上传）
├── start.bat        # Windows 启动脚本
├── update.bat       # Windows 更新脚本
└── package.json
```

## 🔄 更新方法

1. 下载新版 zip，重命名为 `update.zip`
2. 放到程序目录下
3. 双击 `update.bat`

数据会自动备份，不会丢失。

## 🛠 技术栈

- **后端**: Express.js + node:sqlite (Node.js 内置 SQLite)
- **前端**: React + Vite + Tailwind CSS
- **加密**: Node.js crypto (AES-256-GCM, PBKDF2, bcrypt)
- **认证**: JWT + TOTP (speakeasy)

## 🤝 参与贡献

欢迎提 Issue 和 PR！这个项目还在早期阶段，任何建议都很有价值。

## 📄 License

[MIT](LICENSE)
