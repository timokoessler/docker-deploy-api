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

export async function createDockerTestContainer(name: string, image: string) {
    const docker = getDockerConnection();
    const container = await docker.createContainer({
        Image: image,
        name: name,
        Labels: {
            'docker-deploy-api': 'test',
        },
        Cmd: ['tail', '-f', '/dev/null'],
    });
    await container.start();
    return container;
}

export function timeDiff(
    time1: Date | string | number,
    time2: Date | string | number,
) {
    const t1 = new Date(time1).getTime();
    const t2 = new Date(time2).getTime();
    return t2 - t1;
}
