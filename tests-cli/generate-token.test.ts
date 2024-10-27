import { ANSI, CLITest } from 'interactive-cli-tester';
import { initDocker } from '../src/core/docker';
import { createDockerTestContainer, sleep } from '../tests/test-helpers';
import { Container } from 'dockerode';

let command = 'npx';
if (process.platform === 'win32') {
    command = 'npx.cmd';
}

process.env.NODE_ENV = 'TEST';

let testContainer: Container;

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

beforeAll(async () => {
    await initDocker(true);
    testContainer = await createDockerTestContainer(
        'docker-deploy-api-test-cli',
        'busybox:latest',
    );
    await sleep(100);
});

test('Start CLI and select "Generate a Deploy Token"', async () => {
    await cliTest.run();
    await cliTest.waitForOutput('What do you want to do?');
    await cliTest.write(ANSI.CR);
});

test('Wait for container selection', async () => {
    await cliTest.waitForOutput(
        'Select one or multiple containers for which you want to generate a deploy token',
    );
    // Select the first container
    await cliTest.write(ANSI.SPACE);
    await cliTest.write(ANSI.CR);
});

test('Set token expiration', async () => {
    await cliTest.waitForOutput('Should the deploy token expire?');
    await cliTest.write(ANSI.CR);
    await cliTest.waitForOutput('How long should the deploy token be valid?');
    await cliTest.write('1h');
    await cliTest.write(ANSI.CR);
});

test('Set token action', async () => {
    await cliTest.waitForOutput('What action should the token perform?');
    await cliTest.write(ANSI.CR);
    await cliTest.waitForOutput(
        'Should the old image be removed after pulling the new one?',
    );
    await cliTest.write(ANSI.CR);
});

test('Wait for token generation', async () => {
    expect(await cliTest.waitForExit()).toBe(0);
    expect(cliTest.getOutput()).toContain('Token generated.');
});

// Undo
afterAll(async () => {
    if (testContainer) {
        await testContainer.stop();
        await testContainer.remove({ force: true });
    }
});
