@echo off
cd /d "%~dp0"
set /p IP=Digite o IP da impressora (ex: 192.168.0.50): 
node agente.js --teste %IP%
pause
