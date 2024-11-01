import type { Request, Response, NextFunction } from 'express';

export function handleCORS(req: Request, res: Response, next: NextFunction) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'x-deploy-token');
    res.header('Access-Control-Max-Age', '86400');

    if ('options' === req.method?.toLowerCase()) {
        return res.sendStatus(204);
    }
    next();
}
