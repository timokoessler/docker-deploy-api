import express from 'express';
import { default as indexPage } from './pages/index';
import { getConfig } from '../core/config';
import { setupDeployRoutes } from './deploy';
import { default as requestSh } from './scripts/request.sh';
import { default as logo } from './pages/assets/logo.svg';

export function setupRoutes(app: express.Application) {
    app.get('/', (req, res) => {
        if (getConfig().disableIndexPage) {
            res.sendStatus(204);
            return;
        }
        res.send(indexPage);
    });

    app.get('/robots.txt', (req, res) => {
        res.type('text/plain');
        res.send('User-agent: *\nDisallow: /');
    });

    app.get('/logo.svg', (req, res) => {
        res.type('image/svg+xml');
        res.send(logo);
    });

    app.get('/s', (req, res) => {
        res.type('text/plain');
        res.send(requestSh.replaceAll('{{URL}}', getConfig().url));
    });

    setupDeployRoutes(app);
}
