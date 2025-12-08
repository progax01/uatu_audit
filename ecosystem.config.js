module.exports = {
  apps: [{
    name: 'uatu-audit',
    script: 'dist/bin/uatu.js',
    args: 'daemon',
    cwd: '/home/azureuser/UatuAudit',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '6G',
    env: {
      NODE_ENV: 'production',
      UATU_PORT: 9090,
      UATU_HOME: '/home/azureuser/.uatu',
      UATU_NODE_HEAP_MB: 6144
    },
    error_file: '/home/azureuser/.uatu/logs/pm2-error.log',
    out_file: '/home/azureuser/.uatu/logs/pm2-out.log',
    log_file: '/home/azureuser/.uatu/logs/pm2-combined.log',
    time: true,
    merge_logs: true
  }]
};
