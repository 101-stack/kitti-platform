/**
 * PM2 Ecosystem Config — Kitti Platform
 * Usage: pm2 start ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'kitti-node',
      cwd: './node-server',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 4000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      error_file: './node-server/logs/error.log',
      out_file: './node-server/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'kitti-fastapi',
      cwd: './fastapi-service',
      script: 'uvicorn',
      args: 'app.main:app --host 127.0.0.1 --port 8000 --workers 2',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: './fastapi-service/logs/error.log',
      out_file: './fastapi-service/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'kitti-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './frontend/logs/error.log',
      out_file: './frontend/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
