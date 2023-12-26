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

if (cluster.isPrimary) {
    const config = initConfig();
    setupPaseto();

    if (isDev()) {
        log('warn', 'Running in development mode');
    }

    if (process.env['URL'] === undefined) {
        log('warn', 'Environment variable URL is not set. This is required for the bash script to work.');
    }

    for (let i = 0; i < config.workers; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker) => {
        log('error', `Worker ${worker.process.pid} died`);
        cluster.fork();
    });
} else {
    const app: express.Application = express();
    const config = initConfig();
    app.disable('x-powered-by');

    if (config.behindProxy) {
        app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
    }

    if (config.sentryDsn.length > 0) {
        log('info', 'Enabling Sentry error reporting');
        Sentry.init({
            dsn: config.sentryDsn,
            tracesSampleRate: 0.2,
            environment: isDev() ? 'development' : 'production',
            integrations: [
                // enable HTTP calls tracing
                new Sentry.Integrations.Http({ tracing: true }),
                // enable Express.js middleware tracing
                new Sentry.Integrations.Express({ app }),
                // Automatically instrument Node.js libraries and frameworks
                ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
            ],
        });
        app.use(Sentry.Handlers.requestHandler());
        app.use(Sentry.Handlers.tracingHandler());
    }

    app.use(handleCORS);

    initPaseto();
    initDocker();
    setupRoutes(app);

    if (config.sentryDsn.length > 0) {
        app.use(Sentry.Handlers.errorHandler());
    }

    app.use((_req, res) => {
        res.sendStatus(404);
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use(function (err, req, res, next) {
        log('error', err.message);
        res.sendStatus(500);
    });

    app.listen(config.port, config.ip, () => {
        log('info', `Listening on ${config.ip}:${config.port}`);
    });
}
