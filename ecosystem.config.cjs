module.exports = {
  apps: [{
    name: 'axis-tcc',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/root/axis-tcc',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      TZ: 'UTC'
    }
  }]
}
