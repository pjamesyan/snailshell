#!/bin/bash
echo ""
echo "========================================"
echo "   🔐 账号管理器 v2 启动中..."
echo "========================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js！"
    echo "请先安装: https://nodejs.org/"
    exit 1
fi

# Install deps if needed
if [ ! -d "node_modules" ]; then
    echo "[安装] 首次运行，正在安装依赖..."
    npm install --production
    echo "[完成] 依赖安装成功！"
    echo ""
fi

# Get local IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo "========================================"
echo "   🔐 账号管理器已启动！"
echo ""
echo "   本机访问: http://localhost:3001"
echo "   局域网:   http://${LOCAL_IP}:3001"
echo ""
echo "   按 Ctrl+C 停止服务"
echo "========================================"
echo ""

node server/index.js
