import { default as indexPage } from './pages/index';
import { getConfig } from '../core/config';
import { setupDeployRoutes } from './deploy';
import { default as requestSh } from './scripts/request.sh';
import { default as requestPs1 } from './scripts/request.ps1';
import { default as logo } from './pages/assets/logo.svg';
import type { Hono } from 'hono';

export function setupRoutes(app: Hono) {
    app.get('/', async (c) => {
        if (getConfig().disableIndexPage) {
            c.status(204);
            return;
        }
        c.body(indexPage);
    });

    app.get('/robots.txt', async (c) => {
        c.header('Content-Type', 'text/plain');
        c.body('User-agent: *\nDisallow: /');
    });

    app.get('/logo.svg', async (c) => {
        c.header('Content-Type', 'mage/svg+xml');
        c.body(logo);
    });

    app.get('/s', async (c) => {
        c.header('Content-Type', 'text/plain');
        c.body(
            requestSh
                .replace('{{URL}}', getConfig().url)
                .replace('{{TIMEOUT}}', getConfig().scriptTimeout.toString()),
        );
    });

    app.get('/pwsh', async (c) => {
        c.header('Content-Type', 'text/plain');
        c.body(
            requestPs1
                .replace('{{URL}}', getConfig().url)
                .replace('{{TIMEOUT}}', getConfig().scriptTimeout.toString()),
        );
    });

    setupDeployRoutes(app);
}
