import { V4 as paseto } from 'paseto';
import { writeFile, readFile, access, constants as fsConstants } from 'node:fs/promises';
import { KeyObject } from 'node:crypto';
import { log } from './logger';

const keyDir = __dirname + '/data';
const keyPath = `${keyDir}/key.pem`;
let key: KeyObject;

/**
 * Generates a new key for PASETO if none exists and saves it to disk
 * Should be called once on startup from the primary process
 */
export async function setupPaseto() {
    try {
        await access(keyDir, fsConstants.W_OK | fsConstants.R_OK | fsConstants.F_OK);
    } catch {
        if (process.platform === 'win32') {
            log(
                'error',
                `Accessing directory "${keyDir.replaceAll('/', '\\')}" failed. Please make sure it exists and user has write permissions`,
            );
            process.exit(1);
        }
        log(
            'error',
            `Accessing directory "${keyDir}" failed. Please make sure it exists and user with id ${process.getuid()} has write permissions`,
        );
        process.exit(1);
    }

    try {
        await access(keyPath, fsConstants.W_OK | fsConstants.R_OK | fsConstants.F_OK);
    } catch {
        try {
            log('info', 'No key found, generating new key');
            const newKey = paseto.keyObjectToBytes(await paseto.generateKey('public'));
            await writeFile(keyPath, newKey.toString('base64'), 'ascii');
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
export async function initPaseto() {
    try {
        const keyTxt = await readFile(keyPath, 'ascii');
        key = paseto.bytesToKeyObject(Buffer.from(keyTxt, 'base64'));
    } catch (err) {
        log('error', `Error reading key for authentication: ${err.message}`);
        process.exit(1);
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

export async function verifyDeployToken(token: string): Promise<Record<string, unknown>> {
    try {
        return await paseto.verify(token, key);
    } catch (err) {
        return undefined;
    }
}
