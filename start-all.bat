@echo off
chcp 65001 > nul
title PC Mall Full-Stack Dev Server

echo =======================================================
echo 🚀 KHỞI ĐỘNG HỆ THỐNG PC MALL (FULL-STACK)
echo    ➜ Frontend Web: http://localhost:5173
echo    ➜ Backend API:  http://localhost:4000
echo    ➜ Database:     MySQL port 3307 (Docker cnm_mysql)
echo    ➜ phpMyAdmin:   http://localhost:8080
echo =======================================================

cd /d "%~dp0"

REM Kiểm tra và bật container MySQL nếu chưa chạy
echo 📦 Đang kiểm tra container Docker MySQL (cnm_mysql)...
docker start cnm_mysql >nul 2>&1

REM Khởi chạy đồng thời Backend và Frontend
echo ⚡ Đang khởi động Backend API và Frontend Web...
npm run dev

