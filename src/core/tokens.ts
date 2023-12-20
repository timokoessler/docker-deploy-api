import { V4 as paseto } from 'paseto';
import { existsSync } from 'node:fs';
import { writeFile, readFile } from 'node:fs/promises';
import { KeyObject } from 'node:crypto';
import { log } from './logger';

const keyPath = __dirname + '/paseto_key.pem';
let key: KeyObject;

/**
 * Should be called once on startup from the primary process
 */
export async function setupPaseto() {
    try {
        if (!existsSync(keyPath)) {
            await writeFile(keyPath, paseto.keyObjectToBytes(await paseto.generateKey('public')).toString('base64'));
        }
    } catch (err) {
        log('error', `Error setting up key for authentication: ${err.message}`);
        process.exit(1);
    }
}

/**
 * Should be called once on startup from the sub processes
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
 * @param expiresIn
 * @returns
 */
export async function generatePasetoToken(data: Record<string, unknown>, expiresIn: string): Promise<string> {
    return await paseto.sign({ ...data }, key, {
        expiresIn,
    });
}

export async function verifyPasetoToken(token: string): Promise<Record<string, unknown>> {
    try {
        return await paseto.verify(token, key);
    } catch (err) {
        return undefined;
    }
}
