/* eslint-disable security/detect-object-injection */

import { log } from './logger';

const config = {
    port: 3000,
    ip: '0.0.0.0',
    url: 'http://localhost:3000',
    workers: 1,
    behindProxy: true,
    sentryDsn: '',
};

export function initConfig() {
    for (const key in config) {
        if (process.env[key.toUpperCase()]) {
            switch (typeof config[key]) {
                case 'number':
                    config[key] = Number(process.env[key.toUpperCase()]);
                    if (isNaN(config[key])) {
                        log('error', `Environment variable ${key} is not a number`);
                        process.exit(1);
                    }
                    break;
                case 'boolean':
                    if (process.env[key.toUpperCase()] !== 'true' && process.env[key.toUpperCase()] !== 'false') {
                        log('error', `Environment variable ${key} is not a boolean`);
                        process.exit(1);
                    }
                    config[key] = process.env[key.toUpperCase()] === 'true';
                    break;
                default:
                    config[key] = process.env[key.toUpperCase()];
            }
        }
    }
    return config;
}

export function getConfig() {
    return config;
}
