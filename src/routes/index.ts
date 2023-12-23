import express from 'express';
import { default as indexPage } from './pages/index';
import { getConfig } from '../core/config';
import { setupDeployRoutes } from './deploy';

export function setupRoutes(app: express.Application) {
    app.get('/', async (req, res) => {
        if (getConfig().disableIndexPage) {
            res.sendStatus(204);
            return;
        }
        res.send(indexPage);
    });

    app.get('/robots.txt', async (req, res) => {
        res.type('text/plain');
        res.send('User-agent: *\nDisallow: /');
    });

    setupDeployRoutes(app);
}
