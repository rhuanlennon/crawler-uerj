module.exports = {
  apps: [{
    name: 'uerj-monitor',
    script: 'dist/index.js',
    env_file: '.env',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000
  }]
};
