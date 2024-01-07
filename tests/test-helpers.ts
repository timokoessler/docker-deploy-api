import { initConfig } from '../src/core/config';
import { initApp } from '../src/app';
import { setupPaseto } from '../src/core/tokens';
import { getDockerConnection } from '../src/core/docker';

export async function initServer() {
    await setupPaseto();
    const config = initConfig();
    const app = initApp(config);
    await sleep(1000);
    return app;
}

export async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createDockerTestContainer() {
    const docker = getDockerConnection();
    const container = await docker.createContainer({
        Image: 'busybox',
        name: 'docker-deploy-api-test',
        Labels: {
            'docker-deploy-api': 'test',
        },
        Cmd: ['tail', '-f', '/dev/null'],
    });
    await container.start();
    return container;
}
