// @ts-expect-error Wrong type definitions
import { Input } from 'enquirer';
import ora from 'ora';
import { initPaseto, setupPaseto, verifyDeployToken } from '../core/tokens';
import { DeployToken } from '../types';
import {
    access,
    constants as fsConstants,
    readFile,
    writeFile,
} from 'node:fs/promises';
import { getDataDir, sha512 } from '../core/helpers';

export async function cliRevokeToken() {
    const tokenPrompt = new Input({
        message: 'Please paste or enter the token you want to revoke',
        validate: (input) => {
            if (typeof input === 'string' && input.startsWith('v4.public.')) {
                return true;
            }
            return 'Invalid input';
        },
    });

    const inputToken = await tokenPrompt.run();
    const spinner = ora('Revoking token').start();

    await setupPaseto();
    await initPaseto(true);
    const token = (await verifyDeployToken(inputToken)) as DeployToken;
    if (!token) {
        spinner.fail('The token you entered is invalid or already expired');
        process.exit(1);
    }

    const revokedFile = `${getDataDir()}/revoked-tokens.json`;
    let fileExists = false;
    try {
        await access(revokedFile, fsConstants.F_OK);
        fileExists = true;
    } catch {
        fileExists = false;
    }

    let revokedTokens: string[];
    if (fileExists) {
        try {
            revokedTokens = JSON.parse(await readFile(revokedFile, 'ascii'));
            if (!Array.isArray(revokedTokens)) {
                spinner.fail(
                    'Failed to read revoked tokens file, please make sure that the file only contains an array of strings in valid JSON format',
                );
                process.exit(1);
            }
        } catch (error) {
            spinner.fail(
                `Failed to read revoked tokens file: ${error.message}`,
            );
            process.exit(1);
        }
    } else {
        revokedTokens = [];
    }

    const tokenHash = sha512(inputToken);
    if (revokedTokens.includes(tokenHash)) {
        spinner.fail('The token you entered is already revoked');
        process.exit(1);
    }

    revokedTokens.push(tokenHash);
    try {
        await writeFile(revokedFile, JSON.stringify(revokedTokens), 'ascii');
    } catch (error) {
        spinner.fail(`Failed to write revoked tokens file: ${error.message}`);
        process.exit(1);
    }

    spinner.succeed(
        'Token successfully revoked. You need to restart the Docker Deploy API container for this to take effect',
    );
}
