/* eslint-disable security/detect-object-injection */
// @ts-expect-error Wrong type definitions
import { Input, Toggle, Password } from 'enquirer';
import { getContainerRegistryHost } from '../core/docker';
import { access, constants as fsConstants, readFile, writeFile } from 'fs/promises';
import ora from 'ora';

export async function cliAddRegistryAuth() {
    const authFilePath = `${__dirname}/data/registry-auth.json`;
    let fileExists = false;
    try {
        await access(authFilePath, fsConstants.F_OK);
        fileExists = true;
    } catch {
        fileExists = false;
    }

    const spinner = ora('Loading auth data').start();

    let auths: Record<string, { auth: string }> = {};
    if (fileExists) {
        try {
            auths = JSON.parse(await readFile(authFilePath, 'utf-8'));
        } catch (err) {
            spinner.fail(`Failed to read auth file: ${err.message}`);
            process.exit(1);
        }
    }

    spinner.succeed('Loaded auth data');

    const dockerHubToggle = new Toggle({
        message: 'Do you want to add login data for Docker Hub or for another container registry?',
        enabled: 'Docker Hub',
        disabled: 'Other registry',
        initial: true,
    });

    const dockerHub = await dockerHubToggle.run();

    let host = 'docker.io';

    if (!dockerHub) {
        const hostPrompt = new Input({
            message: 'Please enter the host or url of the container registry you want to add',
            validate: (input) => {
                if (typeof input !== 'string') {
                    return false;
                }
                if (!input.includes('.') || input.includes(' ')) {
                    return 'Invalid input';
                }
                return true;
            },
        });

        const hostInput = await hostPrompt.run();
        host = getContainerRegistryHost(hostInput);
    }

    if (auths[host]) {
        spinner.fail(
            'Login details for this registry already exist. Please remove them first from the json file if you want to add new ones.',
        );
        process.exit(1);
    }

    const usernamePrompt = new Input({
        message: 'Please enter the username that should be used for logging in',
    });

    const username = await usernamePrompt.run();
    if (typeof username !== 'string') {
        spinner.fail('Invalid username');
        process.exit(1);
    }

    const passwordPrompt = new Password({
        message: 'Please enter the password',
    });

    const password = await passwordPrompt.run();

    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    auths[host] = {
        auth,
    };

    try {
        await writeFile(authFilePath, JSON.stringify(auths), 'utf-8');
    } catch (err) {
        spinner.fail(`Failed to write file: ${err.message}`);
        process.exit(1);
    }

    spinner.succeed('Successfully saved login data');
}
