/* eslint-disable security/detect-object-injection */
import Docker from 'dockerode';
import { log } from './logger';
import * as Sentry from '@sentry/node';
import { access, readFile, constants as fsConstants } from 'fs/promises';
import { homedir } from 'os';
import { getDataDir, isTest } from './helpers';

let docker: Docker;
let internalCredentialStoreAvailable = false;

export async function initDocker(cli = false) {
    try {
        docker = new Docker();
        await docker.ping();
        if (!cli) {
            internalCredentialStoreAvailable = await checkDockerCredentialStore();
            log('info', 'Connected to Docker socket');
        }
        return true;
    } catch (error) {
        if (cli) return false;
        log('error', `Failed to connect to Docker socket: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Pulls a Docker image from a container registry.
 * @param imageName Name of the image to pull in the format `repository:tag` (e.g. `nginx:latest`)
 * @returns A promise that resolves when the image has been pulled.
 */
export async function pullImage(
    imageName: string,
    auth?: { username: string; password: string },
): Promise<{ status: string; progressDetail?: { current: number; total: number }; progress?: string; id?: string }[]> {
    return new Promise((resolve, reject) => {
        try {
            const config = {};
            if (typeof auth === 'object' && typeof auth.username === 'string' && typeof auth.password === 'string') {
                config['authconfig'] = {
                    username: auth.username,
                    password: auth.password,
                };
            }
            docker.pull(imageName, config, (err, stream) => {
                if (err) {
                    log('error', `Failed to pull image: ${err.message}`);
                    Sentry.captureException(err);
                    reject(err);
                    return;
                }
                docker.modem.followProgress(stream, (err, result) => {
                    if (err) {
                        log('error', `Failed to follow image pull progress: ${err.message}`);
                        reject(err);
                        return;
                    }
                    resolve(result);
                });
            });
        } catch (error) {
            log('error', `Failed to pull image: ${error.message}`);
            Sentry.captureException(error);
            reject(error);
        }
    });
}

/**
 * Recreates a Docker container from an existing container.
 * @param container A Docker container to recreate.
 * @returns A promise that resolves when the container has been recreated, returns the new container.
 */
export async function recreateContainer(container: Docker.Container) {
    try {
        const inspectInfo = await container.inspect();

        await container.stop();
        await container.remove();

        const newContainer = await docker.createContainer({
            ...inspectInfo.Config,
            HostConfig: inspectInfo.HostConfig,
            name: inspectInfo.Name.replace('/', ''),
        });

        await newContainer.start();

        return newContainer;
    } catch (error) {
        log('error', `Failed to recreate container: ${error.message}`);
        Sentry.captureException(error);
        return undefined;
    }
}

/**
 * Restarts a Docker container.
 * @param container A Docker container to restart.
 * @returns A promise that resolves when the container has been restarted.
 */
export async function restartContainer(container: Docker.Container) {
    try {
        await container.restart();
        return true;
    } catch (error) {
        log('error', `Failed to restart container: ${error.message}`);
        Sentry.captureException(error);
        return false;
    }
}

/**
 * Get a list of all Docker containers.
 * @returns A promise that resolves when the list has been retrieved, returns the list, or undefined if an error occurred.
 */
export async function getContainerInfoList() {
    try {
        const containers = await docker.listContainers({ all: true });
        return containers;
    } catch (error) {
        log('error', `Failed to list containers: ${error.message}`);
        Sentry.captureException(error);
        return undefined;
    }
}

/**
 * Gets a Docker container by its ID.
 * @param containerID ID of the container to get.
 * @returns A promise that resolves when the container has been retrieved, returns the container.
 */
export function getContainerByID(containerID: string) {
    try {
        const container = docker.getContainer(containerID);
        return container;
    } catch (error) {
        log('error', `Failed to get container: ${error.message}`);
        Sentry.captureException(error);
        return undefined;
    }
}

/**
 * Gets a Docker image by its name.
 * @param imageName Name of the image to get.
 * @returns The Docker image or undefined if an error occurred.
 */
export function getDockerImage(imageName: string) {
    try {
        return docker.getImage(imageName);
    } catch (error) {
        log('error', `Failed to get image: ${error.message}`);
        Sentry.captureException(error);
        return undefined;
    }
}

/**
 * Gets the ID of the container the application is running in, if it is running in a container.
 * @returns The container ID or undefined if the application is not running in a container.
 */
export async function getOwnContainerID() {
    if (process.env.IS_DOCKER !== 'true') {
        return undefined;
    }
    try {
        return (await readFile('/proc/self/cgroup', 'utf8')).split('\n')[0].split('/')[2];
    } catch (error) {
        return undefined;
    }
}

/**
 * Checks if the Docker config file exists and if no external credential store is configured.
 * @returns True if the file exists and no external credential store is configured, false otherwise.
 */
async function checkDockerCredentialStore(): Promise<boolean> {
    try {
        await access(`${homedir()}/.docker/config.json`, fsConstants.R_OK | fsConstants.F_OK);
    } catch {
        log('info', 'No Docker config found, skip checking credential store.');
        return false;
    }
    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const dockerConfigFile = await readFile(`${homedir()}/.docker/config.json`, 'utf8');
        const dockerConfig = JSON.parse(dockerConfigFile);
        if (dockerConfig.credsStore || dockerConfig.credHelpers) {
            if (!isTest())
                log(
                    'warn',
                    'Can not automatically get login data for private Docker registries, because a credential store is configured.',
                );
            return false;
        }

        return true;
    } catch (error) {
        log('error', `Failed to check Docker credential store: ${error.message}`);
        return false;
    }
}

/**
 * Gets the login data for a Docker registry from the Docker config file or a custom auth file.
 * @param imageName Name of the image to get the login data for.
 * @returns The login data or undefined if no login data was found.
 */
export async function getContainerRegistryAuth(imageName: string): Promise<{
    username: string;
    password: string;
}> {
    try {
        const host = getContainerRegistryHost(imageName);

        const authFilePath = `${getDataDir()}/registry-auth.json`;
        let authFileExists = false;
        try {
            await access(authFilePath, fsConstants.R_OK | fsConstants.F_OK);
            authFileExists = true;
        } catch {
            authFileExists = false;
        }

        if (authFileExists) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            const authFile = await readFile(authFilePath, 'utf8');
            const authData = JSON.parse(authFile);
            for (const [registry, content] of Object.entries(
                authData as Record<string, { auth?: string; username?: string; password?: string }>,
            )) {
                if (host === getContainerRegistryHost(registry)) {
                    if (typeof content !== 'object') {
                        return undefined;
                    }
                    if (typeof content.auth === 'string') {
                        const auth = Buffer.from(content.auth, 'base64').toString('utf8');
                        const [username, password] = auth.split(':');
                        return { username, password };
                    }
                    if (typeof content.username === 'string' && typeof content.password === 'string') {
                        return { username: content.username, password: content.password };
                    }
                }
            }
        }

        if (internalCredentialStoreAvailable) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            const dockerConfigFile = await readFile(`${homedir()}/.docker/config.json`, 'utf8');
            const dockerConfig = JSON.parse(dockerConfigFile);
            if (typeof dockerConfig.auths === 'object') {
                for (const [registry, content] of Object.entries(dockerConfig.auths as Record<string, { auth: string }>)) {
                    if (host === getContainerRegistryHost(registry)) {
                        if (typeof content !== 'object') {
                            return undefined;
                        }
                        if (typeof content.auth !== 'string') {
                            return undefined;
                        }
                        const auth = Buffer.from(content.auth, 'base64').toString('utf8');
                        const [username, password] = auth.split(':');
                        return { username, password };
                    }
                }
            }
        }

        return undefined;
    } catch (error) {
        log('error', `Failed to find login data for pulling image ${imageName}: ${error.message}`);
        Sentry.captureException(error);
        return undefined;
    }
}

/**
 * Converts a Docker image name or a host / url string to a registry host.
 * @returns The registry host or `docker.io` if no host was found.
 */
export function getContainerRegistryHost(tag: string): string {
    // Remove leading protocol
    tag = tag.replace(/^[^:]+:\/\//, '');
    const host = tag.split('/')[0];
    if (!host.includes('.') || host.includes('.docker.io') || host === 'hub.docker.com') {
        return 'docker.io';
    }
    return host;
}

/**
 * Gets the Dockerode instance.
 * @returns The Dockerode instance.
 */
export function getDockerConnection() {
    return docker;
}
