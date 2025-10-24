const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    // 自动检测环境：Docker 环境使用服务名，本地开发使用 localhost
    const isDockerEnv = process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'production';
    const target = isDockerEnv ? 'http://backend:8911' : 'http://localhost:8911';

    console.log(`[Proxy] Using target: ${target} (Docker: ${isDockerEnv})`);

    app.use(
        '/api',
        createProxyMiddleware({
            target: target,
            changeOrigin: true,
            logLevel: 'debug',
            pathRewrite: {
                '^/api': '',
            },
            timeout: 130000,
            proxyTimeout: 130000,
        })
    );
};