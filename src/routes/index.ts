import express from 'express';
import { default as indexPage } from './pages/index';
import { getConfig } from '../core/config';
import { verifyDeployToken } from '../core/tokens';
import { DeployToken } from '../types';

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

    app.post('/v1/deploy', async (req, res) => {
        const deployToken = req.header('X-Deploy-Token');
        if (typeof deployToken !== 'string' || !deployToken.length) {
            res.status(401).json({ error: 'Missing X-Deploy-Token header' });
            return;
        }
        const token = (await verifyDeployToken(deployToken)) as DeployToken;
        if (!token) {
            res.status(401).json({ error: 'Invalid X-Deploy-Token header' });
            return;
        }

        // TODO: Implement

        res.status(200).json({ success: true });
    });
}
