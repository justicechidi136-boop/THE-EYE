@echo off
cd /d "C:\Users\USER\Documents\the eye 2"
set "PATH=C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin;%PATH%"
set "NEXT_TELEMETRY_DISABLED=1"
if not exist runtime-logs mkdir runtime-logs
cd /d "C:\Users\USER\Documents\the eye 2\apps\admin-web"
"C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" node_modules\next\dist\bin\next dev -p 3000 1>"C:\Users\USER\Documents\the eye 2\runtime-logs\admin-web.out.log" 2>"C:\Users\USER\Documents\the eye 2\runtime-logs\admin-web.err.log"
