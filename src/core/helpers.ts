/* eslint-disable unicorn/prefer-module */
import { createHash } from 'node:crypto';

export const isDev = () => process.env.NODE_ENV?.toLowerCase() !== 'production';

export const isTest = () =>
    process.env.NODE_ENV?.toLowerCase().includes('test');

export const isCLITest = () =>
    process.env.NODE_ENV?.toLowerCase() === 'cli-test';

export function getDataDir() {
    if (isTest()) {
        return isCLITest()
            ? __dirname + '/../tests/data'
            : __dirname + '/../../tests/data';
    }
    return __dirname + '/data';
}

/**
 * Generates a sha512 hash from a string
 * @param input  The string to hash
 * @returns The hash as a hex string
 */
export function sha512(input: string) {
    return createHash('sha512').update(input).digest('hex');
}
