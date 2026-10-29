@echo off
chcp 65001 >nul
title Galata Rotary Bülten Stüdyosu

echo ========================================================================
echo   GALATA ROTARY BÜLTEN STÜDYOSU (2026-2027)
echo   UR 2420. Bölge - Galata Rotary Kulübü (Kulüp No: 64336)
echo   Dönem Teması: KALICI ETKİ YARAT
echo ========================================================================
echo.
echo Sunucu başlatılıyor ve web arayüzü tarayıcınızda açılıyor...
echo URL: http://localhost:3420
echo.

start "" "http://localhost:3420"
node server.mjs

pause
