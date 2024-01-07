/* eslint-disable security/detect-non-literal-fs-filename */
import { V4 as paseto } from 'paseto';
import { writeFile, readFile, access, constants as fsConstants } from 'node:fs/promises';
import { KeyObject } from 'node:crypto';
import { log } from './logger';
import { getDataDir, sha512 } from './helpers';

let key: KeyObject;
let revokedTokens: string[] = [];

/**
 * Generates a new key for PASETO if none exists and saves it to disk
 * Should be called once on startup from the primary process
 */
export async function setupPaseto() {
    try {
        await access(getDataDir(), fsConstants.W_OK | fsConstants.R_OK | fsConstants.F_OK);
    } catch {
        if (process.platform === 'win32') {
            log(
                'error',
                `Accessing directory "${getDataDir().replaceAll(
                    '/',
                    '\\',
                )}" failed. Please make sure it exists and user has write permissions`,
            );
            process.exit(1);
        }
        log(
            'error',
            `Accessing directory "${getDataDir()}" failed. Please make sure it exists and user with id ${process.getuid()} has write permissions`,
        );
        process.exit(1);
    }

    try {
        await access(`${getDataDir()}/key.pem`, fsConstants.W_OK | fsConstants.R_OK | fsConstants.F_OK);
    } catch {
        try {
            log('info', 'No key found, generating new key');
            const newKey = paseto.keyObjectToBytes(await paseto.generateKey('public'));
            await writeFile(`${getDataDir()}/key.pem`, newKey.toString('base64'), 'ascii');
            log('info', 'Key generated');
        } catch (err) {
            log('error', `Error generating and saving key: ${err.message}`);
            process.exit(1);
        }
    }
}

/**
 * Loads the key for PASETO from disk
 * Should be called once on startup from the worker processes
 */
export async function initPaseto(cli = false) {
    try {
        const keyTxt = await readFile(`${getDataDir()}/key.pem`, 'ascii');
        key = paseto.bytesToKeyObject(Buffer.from(keyTxt, 'base64'));
    } catch (err) {
        log('error', `Error reading key for authentication: ${err.message}`);
        process.exit(1);
    }

    let revokedFileExists = false;
    try {
        await access(`${getDataDir()}/revoked-tokens.json`, fsConstants.F_OK);
        revokedFileExists = true;
    } catch {
        revokedFileExists = false;
    }

    if (revokedFileExists) {
        try {
            revokedTokens = JSON.parse(await readFile(`${getDataDir()}/revoked-tokens.json`, 'ascii'));
            if (!Array.isArray(revokedTokens)) {
                log(
                    'error',
                    'Failed to read revoked tokens file, please make sure that the file only contains an array of strings in valid JSON format',
                );
                process.exit(1);
            }
        } catch {
            log(
                'error',
                'Failed to read revoked tokens file, please make sure that the file only contains an array of strings in valid JSON format',
            );
            process.exit(1);
        }
    }

    if (!cli) {
        if (revokedTokens.length > 0) {
            log('info', `Found ${revokedTokens.length} revoked tokens`);
        } else {
            log('info', 'No revoked tokens found');
        }
    }
}

/**
 * Generates a PASETO token
 * @param data Data to be stored in the token
 * @param expiresIn Expiration time for the token as a string (e.g. '1h')
 * @returns
 */
export async function generateDeployToken(data: Record<string, unknown>, expiresIn: string): Promise<string> {
    try {
        return await paseto.sign({ ...data }, key, {
            expiresIn,
        });
    } catch (err) {
        return undefined;
    }
}

/**
 * Parses and verifies a PASETO token
 * @param token The token to be verified
 * @returns the data stored in the token or undefined if the token is invalid
 */
export async function verifyDeployToken(token: string): Promise<Record<string, unknown>> {
    try {
        return await paseto.verify(token, key);
    } catch (err) {
        return undefined;
    }
}

/**
 * Checks if a token has been revoked
 * @param token The token to be checked against the list of revoked tokens
 * @returns true if the token has been revoked, false otherwise
 */
export function isTokenRevoked(token: string): boolean {
    return revokedTokens.includes(sha512(token));
}
