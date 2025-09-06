import indexPage from './pages/index';
import { getConfig } from '../core/config';
import { setupDeployRoutes } from './deploy';
import requestSh from './scripts/request.sh';
import requestPs1 from './scripts/request.ps1';
import logo from './pages/assets/logo.svg';
import type { Hono } from 'hono';

export function setupRoutes(app: Hono) {
    app.get('/', async (c) => {
        if (getConfig().disableIndexPage) {
            return c.body(undefined, 204);
        }
        return c.html(indexPage);
    });

    app.get('/robots.txt', async (c) => {
        return c.text('User-agent: *\nDisallow: /');
    });

    app.get('/logo.svg', async (c) => {
        return c.body(logo, 200, {
            'Content-Type': 'image/svg+xml; charset=UTF-8',
        });
    });

    app.get('/s', async (c) => {
        return c.text(
            requestSh
                .replace('{{URL}}', getConfig().url)
                .replace('{{TIMEOUT}}', getConfig().scriptTimeout.toString()),
        );
    });

    app.get('/pwsh', async (c) => {
        return c.text(
            requestPs1
                .replace('{{URL}}', getConfig().url)
                .replace('{{TIMEOUT}}', getConfig().scriptTimeout.toString()),
        );
    });

    setupDeployRoutes(app);
}
