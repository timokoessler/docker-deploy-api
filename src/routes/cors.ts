import { createMiddleware } from 'hono/factory';

export const handleCORS = createMiddleware(async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    c.header('Access-Control-Allow-Headers', 'x-deploy-token');
    c.header('Access-Control-Max-Age', '86400');

    if ('options' === c.req.method?.toLowerCase()) {
        return c.status(204);
    }
    await next();
});
