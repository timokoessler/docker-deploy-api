import express from 'express';

export function setupRoutes(app: express.Application) {
    app.get('/', async (req, res) => {
        res.send('Hello World!');
    });
}
