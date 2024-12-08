// import '@aikidosec/firewall'; // Should this be included?
import cluster from 'node:cluster';
import { isDev } from './core/helpers';
import { log } from './core/logger';
import * as Sentry from '@sentry/node';
import { setupRoutes } from './routes';
import { initConfig } from './core/config';
import { initPaseto, setupPaseto } from './core/tokens';
import { initDocker } from './core/docker';
import { handleCORS } from './routes/cors';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { HTTPException } from 'hono/http-exception';
import { trimTrailingSlash } from 'hono/trailing-slash';
import { bodyLimit } from 'hono/body-limit';
import { compress } from 'hono/compress';

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

        serve(
            {
                fetch: app.fetch,
                port: config.port,
                hostname: config.ip,
            },
            (info) => {
                log('info', `Listening on ${info.address}:${info.port}`);
            },
        );
    }
}

export function initApp(config: ReturnType<typeof initConfig>): Hono {
    const app: Hono = new Hono();

    // if (config.behindProxy) {
    //     app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
    // }
    // TODO: Is this needed?

    if (config.sentryDsn.length > 0) {
        log('info', 'Enabling Sentry error reporting');
        Sentry.init({
            dsn: config.sentryDsn,
            environment: isDev() ? 'development' : 'production',
        });
    }

    app.use(handleCORS);

    app.use(trimTrailingSlash());
    app.use(
        bodyLimit({
            maxSize: 5 * 1024 * 1024, // 5MB
            onError: (c) => {
                return c.text('Body is too large :(', { status: 413 });
            },
        }),
    );
    app.use(compress());

    initPaseto();
    initDocker();
    setupRoutes(app);

    app.notFound((c) => {
        return c.json({ error: 'Not found' }, 404);
    });

    app.onError((err, c) => {
        return c.json({ error: 'Internal Server Error' }, 500);
    });

    app.onError((err, c) => {
        if (err instanceof HTTPException) {
            return err.getResponse();
        }
        console.error(err);
        Sentry.captureException(err);
        return c.text('Internal Server Error', 500);
    });

    return app;
}
