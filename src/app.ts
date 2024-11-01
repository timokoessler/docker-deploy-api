import express from 'express';
import cluster from 'node:cluster';
import { isDev } from './core/helpers';
import { log } from './core/logger';
import * as Sentry from '@sentry/node';
import { setupRoutes } from './routes';
import { initConfig } from './core/config';
import { initPaseto, setupPaseto } from './core/tokens';
import { initDocker } from './core/docker';
import { handleCORS } from './routes/cors';

// Check if file is being run directly or required as a module
// eslint-disable-next-line unicorn/prefer-module
if (require.main === module) {
    if (cluster.isPrimary) {
        const config = initConfig();
        setupPaseto();

        if (isDev()) {
            log('warn', 'Running in development mode');
        }

        if (process.env['URL'] === undefined) {
            log(
                'warn',
                'Environment variable URL is not set. This is required for the bash script to work.',
            );
        }

        for (let i = 0; i < config.workers; i++) {
            cluster.fork();
        }

        cluster.on('exit', (worker) => {
            log('error', `Worker ${worker.process.pid} died`);
            cluster.fork();
        });
    } else {
        const config = initConfig();
        const app = initApp(config);
        app.listen(config.port, config.ip, () => {
            log('info', `Listening on ${config.ip}:${config.port}`);
        });
    }
}

export function initApp(
    config: ReturnType<typeof initConfig>,
): express.Application {
    const app: express.Application = express();
    app.disable('x-powered-by');

    if (config.behindProxy) {
        app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
    }

    if (config.sentryDsn.length > 0) {
        log('info', 'Enabling Sentry error reporting');
        Sentry.init({
            dsn: config.sentryDsn,
            environment: isDev() ? 'development' : 'production',
        });
    }

    // @ts-expect-error Wrong type definitions
    app.use(handleCORS);

    initPaseto();
    initDocker();
    setupRoutes(app);

    app.use((_req, res) => {
        res.sendStatus(404);
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use(function (err, req, res, next) {
        log('error', err.message);
        res.sendStatus(500);
    });

    return app;
}
