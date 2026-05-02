module.exports = {
  apps: [
    {
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
    },
    {
      name: 'axis-worker-transcribe',
      script: 'npx',
      args: 'tsx scripts/workers/transcription-worker.ts',
      cwd: '/root/axis-tcc',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        TZ: 'UTC'
      }
    }
  ]
}
