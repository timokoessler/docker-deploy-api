import Docker from 'dockerode';
import { log } from './logger';
import * as Sentry from '@sentry/node';
import { readFile } from 'fs/promises';

let docker: Docker;

export async function initDocker(cli = false) {
    try {
        docker = new Docker();
        await docker.ping();
        if (!cli) log('info', 'Connected to Docker socket');
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
): Promise<{ status: string; progressDetail?: { current: number; total: number }; progress?: string; id?: string }[]> {
    return new Promise((resolve, reject) => {
        try {
            docker.pull(imageName, {}, (err, stream) => {
                if (err) {
                    log('error', `Failed to pull image: ${err.message}`);
                    Sentry.captureException(err);
                    reject(err);
                }
                docker.modem.followProgress(stream, (err, result) => {
                    if (err) {
                        log('error', `Failed to pull image: ${err.message}`);
                        reject(err);
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
        return null;
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
 * @returns A promise that resolves when the list has been retrieved, returns the list, or null if an error occurred.
 */
export async function getContainerInfoList() {
    try {
        const containers = await docker.listContainers();
        return containers;
    } catch (error) {
        log('error', `Failed to list containers: ${error.message}`);
        Sentry.captureException(error);
        return null;
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
        return null;
    }
}

/**
 * Gets a Docker image by its name.
 * @param imageName Name of the image to get.
 * @returns The Docker image or null if an error occurred.
 */
export function getDockerImage(imageName: string) {
    try {
        return docker.getImage(imageName);
    } catch (error) {
        log('error', `Failed to get image: ${error.message}`);
        Sentry.captureException(error);
        return null;
    }
}

export async function getOwnContainerID() {
    if (process.env.IS_DOCKER !== 'true') {
        return null;
    }
    try {
        return (await readFile('/proc/self/cgroup', 'utf8')).split('\n')[0].split('/')[2];
    } catch (error) {
        return null;
    }
}
