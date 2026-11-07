@echo off
title Impressao - Parada Obrigatoria (NAO FECHE ESTA JANELA)
cd /d "%~dp0"
:loop
node agente.js
echo O programa parou. Reiniciando em 5 segundos...
timeout /t 5 /nobreak >nul
goto loop
