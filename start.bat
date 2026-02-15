@echo off
chcp 65001 >nul
title SnailShell v0.1.0
echo.
echo ========================================
echo    🐌 SnailShell v0.1.0
echo ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js！
    echo.
    echo 请先安装 Node.js:
    echo   下载地址: https://nodejs.org/
    echo   选择 LTS 版本，一路下一步安装即可
    echo.
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist "node_modules" (
    echo [安装] 首次运行，正在安装依赖...
    echo 这可能需要几分钟，请耐心等待...
    echo.
    call npm install --production
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败！
        pause
        exit /b 1
    )
    echo.
    echo [完成] 依赖安装成功！
    echo.
)

:: Get local IP
echo [信息] 正在启动服务...
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set "LOCAL_IP=%%a"
    goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP: =%

echo ========================================
echo    🐌 SnailShell 已启动！
echo.
echo    本机访问: http://localhost:3001
echo    局域网:   http://%LOCAL_IP%:3001
echo.
echo    其他设备请在浏览器输入上面的局域网地址
echo    按 Ctrl+C 停止服务
echo ========================================
echo.

:: Open browser
start http://localhost:3001

:: Start server
node server/index.js
pause
