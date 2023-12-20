import Docker from 'dockerode';
import { log } from './logger';
import * as Sentry from '@sentry/node';

let docker: Docker;

export async function initDocker() {
    docker = new Docker();
    try {
        await docker.ping();
        log('info', 'Connected to Docker socket');
    } catch (error) {
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
