import { createHash } from 'crypto';

export const isDev = () => process.env.NODE_ENV?.toLowerCase() !== 'production';

export const isTest = () => process.env.NODE_ENV?.toLowerCase() === 'test';

export const getDataDir = () => (!isTest() ? __dirname + '/data' : __dirname + '/../../tests/data');

/**
 * Generates a sha512 hash from a string
 * @param input  The string to hash
 * @returns The hash as a hex string
 */
export function sha512(input: string) {
    return createHash('sha512').update(input).digest('hex');
}
