import type { Application } from 'express';
import { default as indexPage } from './pages/index';
import { getConfig } from '../core/config';
import { setupDeployRoutes } from './deploy';
import { default as requestSh } from './scripts/request.sh';
import { default as requestPs1 } from './scripts/request.ps1';
import { default as logo } from './pages/assets/logo.svg';

export function setupRoutes(app: Application) {
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
        res.send(
            requestSh
                .replace('{{URL}}', getConfig().url)
                .replace('{{TIMEOUT}}', getConfig().scriptTimeout.toString()),
        );
    });

    app.get('/pwsh', (req, res) => {
        res.type('text/plain');
        res.send(
            requestPs1
                .replace('{{URL}}', getConfig().url)
                .replace('{{TIMEOUT}}', getConfig().scriptTimeout.toString()),
        );
    });

    setupDeployRoutes(app);
}
