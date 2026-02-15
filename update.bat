@echo off
chcp 65001 >nul
title SnailShell - 更新工具

echo.
echo ========================================
echo    🐌 SnailShell 更新工具
echo ========================================
echo.

:: Check if update zip exists in same directory
if not exist "update.zip" (
    echo [错误] 请将新版 update.zip 放在当前目录下！
    echo.
    echo 使用方法：
    echo   1. 将收到的新版 zip 重命名为 update.zip
    echo   2. 放到账号管理器目录下
    echo   3. 双击 update.bat
    echo.
    pause
    exit /b 1
)

:: Check if data exists
if exist "data\accounts.db" (
    echo [备份] 正在备份数据库...
    if not exist "backup" mkdir backup
    for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value') do set dt=%%a
    set backup_name=backup\accounts_%dt:~0,8%_%dt:~8,6%.db
    copy "data\accounts.db" "%backup_name%" >nul 2>nul
    if exist "data\uploads" (
        xcopy "data\uploads" "backup\uploads_%dt:~0,8%_%dt:~8,6%\" /E /I /Q >nul 2>nul
    )
    echo [备份] 数据已备份到 backup\ 目录 ✅
) else (
    echo [信息] 未发现旧数据，跳过备份
)

echo.
echo [更新] 正在解压新版代码...

:: Use PowerShell to extract (Windows 10+ built-in)
powershell -Command "Expand-Archive -Path 'update.zip' -DestinationPath 'update_temp' -Force" 2>nul
if %errorlevel% neq 0 (
    echo [错误] 解压失败！请确认 update.zip 是有效的 zip 文件
    pause
    exit /b 1
)

:: Copy server and public (code only, not data)
echo [更新] 正在替换代码文件...
if exist "update_temp\server" (
    xcopy "update_temp\server" "server\" /E /Y /Q >nul
    echo   server\ 已更新 ✅
)
if exist "update_temp\public" (
    xcopy "update_temp\public" "public\" /E /Y /Q >nul
    echo   public\ 已更新 ✅
)
if exist "update_temp\package.json" (
    copy "update_temp\package.json" "package.json" /Y >nul
    echo   package.json 已更新 ✅
)
if exist "update_temp\start.bat" (
    copy "update_temp\start.bat" "start.bat" /Y >nul
    echo   start.bat 已更新 ✅
)

:: Cleanup
rmdir /S /Q "update_temp" >nul 2>nul
del "update.zip" >nul 2>nul

echo.
echo ========================================
echo    ✅ 更新完成！
echo.
echo    你的数据完好无损（已备份到 backup\）
echo    现在可以双击 start.bat 启动了
echo ========================================
echo.
pause
