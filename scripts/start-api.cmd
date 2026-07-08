@echo off
cd /d "C:\Users\USER\Documents\the eye 2"
set "PATH=C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin;%PATH%"
set "DATABASE_URL=postgresql://the_eye:change_me_postgres@localhost:5432/the_eye?schema=public"
set "REDIS_HOST=localhost"
set "THE_EYE_SKIP_DB_CONNECT=1"
set "THE_EYE_DISABLE_REDIS=1"
set "PORT=4000"
if not exist runtime-logs mkdir runtime-logs
cd /d "C:\Users\USER\Documents\the eye 2\apps\api"
"C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" node_modules\tsx\dist\cli.mjs src\main.ts 1>"C:\Users\USER\Documents\the eye 2\runtime-logs\api.out.log" 2>"C:\Users\USER\Documents\the eye 2\runtime-logs\api.err.log"
