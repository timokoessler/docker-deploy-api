/* eslint-disable security/detect-object-injection */

import { log } from './logger';

const config = {
    port: 3000,
    ip: '0.0.0.0',
    url: 'http://localhost:3000',
    workers: 1,
    behindProxy: true,
    sentryDsn: '',
    disableIndexPage: false,
};

function toEnvName(key: string) {
    return key.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
}

export function initConfig() {
    for (const key in config) {
        const envName = toEnvName(key);
        if (process.env[envName]) {
            switch (typeof config[key]) {
                case 'number':
                    config[key] = Number(process.env[envName]);
                    if (isNaN(config[key])) {
                        log('error', `Environment variable ${envName} is not a number`);
                        process.exit(1);
                    }
                    break;
                case 'boolean':
                    if (process.env[envName] !== 'true' && process.env[envName] !== 'false') {
                        log('error', `Environment variable ${key} is not a boolean`);
                        process.exit(1);
                    }
                    config[key] = process.env[envName] === 'true';
                    break;
                default:
                    config[key] = process.env[envName];
            }
        }
    }
    return config;
}

export function getConfig() {
    return config;
}
