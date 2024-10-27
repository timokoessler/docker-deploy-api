import { ANSI, CLITest } from 'interactive-cli-tester';
import {
    generateDeployToken,
    initPaseto,
    setupPaseto,
    verifyDeployToken,
    isTokenRevoked,
} from '../src/core/tokens';
import { DeployToken, DeployTokenAction } from '../src/types';
import { readFile, writeFile } from 'node:fs/promises';
import { getDataDir, sha512 } from '../src/core/helpers';

let command = 'npx';
if (process.platform === 'win32') {
    command = 'npx.cmd';
}

process.env.NODE_ENV = 'TEST';

const cliTest = new CLITest(
    command,
    ['nyc', '-r', 'none', 'node', 'dist/cli.js'],
    {
        failOnStderr: false,
        process: {
            env: {
                ...process.env,
                NODE_ENV: 'cli-test',
            },
            // @ts-expect-error Wrong type definitions?
            shell: true,
        },
    },
);

let token = '';
const revokedTokensFilePath = `${getDataDir()}/revoked-tokens.json`;

test('Generate a Deploy Token to revoke', async () => {
    await setupPaseto();
    await initPaseto(true);
    const tokenCofig: DeployToken = {
        containerNames: ['non-existing-container-abcdefg'],
        action: DeployTokenAction.RESTART,
        cleanup: true,
    };
    token = await generateDeployToken(tokenCofig, '5min');
    expect(await verifyDeployToken(token)).toBeTruthy();
    expect(isTokenRevoked(token)).toBeFalsy();
});

test('Start CLI and select "Revoke a Deploy Token"', async () => {
    await cliTest.run();
    await cliTest.waitForOutput('What do you want to do?');
    await cliTest.write(ANSI.CURSOR_DOWN);
    await cliTest.write(ANSI.CURSOR_DOWN);
    await cliTest.write(ANSI.CR);
});

test('Enter the token to revoke', async () => {
    await cliTest.waitForOutput(
        'Please paste or enter the token you want to revoke',
    );
    await cliTest.write(token);
    await cliTest.write(ANSI.CR);
});

test('Sucessfully revoke the token', async () => {
    expect(await cliTest.waitForExit()).toBe(0);
    expect(cliTest.getOutput()).toContain('Token successfully revoked.');
});

test('Check file for revoked token hash', async () => {
    const revokedTokens = JSON.parse(
        await readFile(revokedTokensFilePath, 'ascii'),
    );
    expect(Array.isArray(revokedTokens)).toBeTruthy();
    expect(revokedTokens).toContain(sha512(token));
});

test('Run again and try to revoke the same token', async () => {
    await cliTest.run();
    await cliTest.waitForOutput('What do you want to do?');
    await cliTest.write(ANSI.CURSOR_DOWN);
    await cliTest.write(ANSI.CURSOR_DOWN);
    await cliTest.write(ANSI.CR);
    await cliTest.waitForOutput(
        'Please paste or enter the token you want to revoke',
    );
    await cliTest.write(token);
    await cliTest.write(ANSI.CR);
    expect(await cliTest.waitForExit()).toBe(1);
    expect(cliTest.getOutput()).toContain(
        'The token you entered is already revoked',
    );
});

test('Run again and try to revoke an expired token', async () => {
    const expiredToken = await generateDeployToken(
        {
            containerNames: ['non-existing-container-abcdefg'],
            action: DeployTokenAction.RESTART,
            cleanup: true,
        },
        '1s',
    );
    await cliTest.run();
    await cliTest.waitForOutput('What do you want to do?');
    await cliTest.write(ANSI.CURSOR_DOWN);
    await cliTest.write(ANSI.CURSOR_DOWN);
    await cliTest.write(ANSI.CR);
    await cliTest.waitForOutput(
        'Please paste or enter the token you want to revoke',
    );
    await cliTest.write(expiredToken);
    await cliTest.write(ANSI.CR);
    expect(await cliTest.waitForExit()).toBe(1);
    expect(cliTest.getOutput()).toContain(
        'The token you entered is invalid or already expired',
    );
});

// Undo changes to the file system
afterAll(async () => {
    let revokedTokens = JSON.parse(
        await readFile(revokedTokensFilePath, 'ascii'),
    ) as string[];
    expect(Array.isArray(revokedTokens)).toBeTruthy();
    revokedTokens = revokedTokens.filter((t: string) => t !== sha512(token));
    await writeFile(
        revokedTokensFilePath,
        JSON.stringify(revokedTokens),
        'ascii',
    );
});
