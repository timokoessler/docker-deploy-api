import express from 'express';

export function handleCORS(req: express.Request, res: express.Response, next: express.NextFunction) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'x-deploy-token');

    if ('options' === req.method?.toLowerCase()) {
        return res.sendStatus(204);
    }
    next();
}
