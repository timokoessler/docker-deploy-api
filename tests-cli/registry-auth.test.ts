/* eslint-disable security/detect-non-literal-fs-filename */
import { ANSI, CLITest } from 'interactive-cli-tester';
import { readFile, writeFile } from 'fs/promises';
import { getDataDir } from '../src/core/helpers';

let command = 'npx';
if (process.platform === 'win32') {
    command = 'npx.cmd';
}

process.env.NODE_ENV = 'TEST';

const cliTest = new CLITest(command, ['nyc', '-r', 'none', 'node', 'dist/cli.js'], {
    failOnStderr: false,
    process: {
        env: {
            ...process.env,
            NODE_ENV: 'cli-test',
        },
    },
});

const authFilePath = `${getDataDir()}/registry-auth.json`;

test('Start CLI and select "Add registry login data"', async () => {
    await cliTest.run();
    await cliTest.waitForOutput('What do you want to do?');
    await cliTest.write(ANSI.CURSOR_DOWN);
    await cliTest.write(ANSI.CR);
});

test('Select Docker Hub', async () => {
    await cliTest.waitForOutput('Do you want to add login data for Docker Hub or for another container registry?');
    await cliTest.write(ANSI.CR);
});

test('Enter username and password and expect success', async () => {
    await cliTest.waitForOutput('Please enter the username that should be used for logging in');
    await cliTest.write('testuser');
    await cliTest.write(ANSI.CR);
    await cliTest.waitForOutput('Please enter the password');
    await cliTest.write('testpassword');
    await cliTest.write(ANSI.CR);
    expect(await cliTest.waitForExit()).toBe(0);
    expect(cliTest.getOutput()).toContain('Successfully saved login data');
});

test('Rerun the CLI should throw error "Login details for this registry already exist."', async () => {
    await cliTest.run();
    await cliTest.waitForOutput('What do you want to do?');
    await cliTest.write(ANSI.CURSOR_DOWN);
    await cliTest.write(ANSI.CR);
    await cliTest.waitForOutput('Do you want to add login data for Docker Hub or for another container registry?');
    await cliTest.write(ANSI.CR);
    expect(await cliTest.waitForExit()).toBe(1);
    expect(cliTest.getOutput()).toContain('Login details for this registry already exist.');
});

test('Rerun the CLI and enter registry host', async () => {
    await cliTest.run();
    await cliTest.waitForOutput('What do you want to do?');
    await cliTest.write(ANSI.CURSOR_DOWN);
    await cliTest.write(ANSI.CR);
    await cliTest.waitForOutput('Do you want to add login data for Docker Hub or for another container registry?');
    await cliTest.write(ANSI.ARROW_RIGHT);
    await cliTest.write(ANSI.CR);
    await cliTest.waitForOutput('Please enter the host or url of the container registry you want to add');
    await cliTest.write('v1.docker.io');
    await cliTest.write(ANSI.CR);
    expect(await cliTest.waitForExit()).toBe(1);
    expect(cliTest.getOutput()).toContain('Login details for this registry already exist.');
});

test('Check auth config file content', async () => {
    const authData = JSON.parse(await readFile(authFilePath, 'ascii'));
    expect(authData).toBeDefined();
    expect(authData['docker.io']).toBeDefined();
    expect(authData['docker.io'].auth).toEqual(Buffer.from('testuser:testpassword').toString('base64'));
});

// Undo changes to the file system
afterAll(async () => {
    const authData = JSON.parse(await readFile(authFilePath, 'ascii'));
    expect(authData).toBeDefined();
    delete authData['docker.io'];
    await writeFile(authFilePath, JSON.stringify(authData), 'ascii');
});
