import { initServer, sleep, timeDiff } from './test-helpers';
import { Container } from 'dockerode';
import { createDockerTestContainer } from './test-helpers';
import {
    getContainerByID,
    getContainerInfoList,
    getDockerImage,
    getOwnContainerID,
    pullImage,
} from '../src/core/docker';
import { DeployToken, DeployTokenAction } from '../src/types';
import { generateDeployToken } from '../src/core/tokens';
import type { Hono } from 'hono';

let app: Hono;
let deployToken = '';
let testContainer: Container;
let imageHash: string;

process.env.NODE_ENV = 'TEST';
process.env.PORT = '3000';
process.env.IP = '127.0.0.1';
process.env.DISABLE_INDEX_PAGE = 'false';

beforeAll(async () => {
    app = await initServer();
});

/**
 * Checks if the test container is running and has the correct properties
 */
async function checkContainer({
    recreated = false,
    restarted = false,
    pulled = false,
}) {
    const containers = await getContainerInfoList();
    expect(containers).toBeTruthy();
    expect(containers!.length).toBeGreaterThan(0);

    const container = containers!.find(
        (c) => c.Names[0] === '/docker-deploy-api-test',
    );
    expect(container).toBeTruthy();

    testContainer = getContainerByID(container!.Id) as Container;
    expect(testContainer).toBeTruthy();

    const containerInfo = await testContainer.inspect();
    expect(containerInfo.State.Running).toBe(true);
    expect(containerInfo.Name).toBe('/docker-deploy-api-test');
    expect(containerInfo.Config.Cmd).toEqual(['tail', '-f', '/dev/null']);
    expect(containerInfo.Config.Labels['docker-deploy-api']).toBe('test');

    if (recreated) {
        expect(timeDiff(containerInfo.Created, Date.now())).toBeLessThan(3000);
        expect(
            timeDiff(containerInfo.Created, containerInfo.State.StartedAt),
        ).toBeLessThan(2000);
    }

    if (pulled) {
        expect(containerInfo.Image).not.toEqual(imageHash);
    } else if (imageHash) {
        expect(containerInfo.Image).toBe(imageHash);
    }

    if (restarted) {
        expect(
            timeDiff(containerInfo.State.StartedAt, Date.now()),
        ).toBeLessThan(3000);
        expect(
            timeDiff(containerInfo.Created, containerInfo.State.StartedAt),
        ).toBeGreaterThan(3000);
    }

    imageHash = containerInfo.Image;
}

test('HTTP GET /', async () => {
    const response = await app.request('/', {
        method: 'GEt',
    });
    expect(response.status).toEqual(200);
});

test('HTTP POST /v1/deploy with empty deploy token', async () => {
    const response = await app.request('/v1/deploy', {
        method: 'POST',
        headers: {
            'X-Deploy-Token': deployToken,
        },
    });
    expect(response.status).toEqual(401);
});

test('Delete busybox 1.35.0 image', async () => {
    const image = getDockerImage('busybox:1.35.0');
    if (!image) {
        return;
    }
    try {
        await image.remove({ force: true });
    } catch (error) {
        if (!error.message.includes('No such image')) {
            throw error;
        }
    }
});

test('Delete busybox latest image', async () => {
    const image = getDockerImage('busybox:latest');
    if (!image) {
        return;
    }
    try {
        await image.remove({ force: true });
    } catch (error) {
        if (!error.message.includes('No such image')) {
            throw error;
        }
    }
});

test('Pull old version of busybox', async () => {
    await pullImage('busybox:1.35.0');
    const image = getDockerImage('busybox:1.35.0');
    await image!.tag({
        repo: 'busybox',
        tag: 'latest',
    });
});

test('Create test container', async () => {
    testContainer = await createDockerTestContainer(
        'docker-deploy-api-test',
        'busybox:latest',
    );
    await sleep(100);
    await checkContainer({});
});

test('Generate deploy token (pull & recreate)', async () => {
    const tokenCofig: DeployToken = {
        containerNames: ['docker-deploy-api-test'],
        action: DeployTokenAction.PULL_AND_RECREATE,
        cleanup: true,
    };
    deployToken = await generateDeployToken(tokenCofig, '1min');
    expect(deployToken).toBeTruthy();
    expect(deployToken.length).toBeGreaterThan(0);
});

test('HTTP POST /v1/deploy (pull & recreate)', async () => {
    const response = await app.request('/v1/deploy', {
        method: 'POST',
        headers: {
            'X-Deploy-Token': deployToken,
        },
    });
    expect(response.status).toEqual(200);
});

test('Check recreated container', async () => {
    await checkContainer({ recreated: true, pulled: true });
});

test('Generate deploy token (restart)', async () => {
    const tokenCofig: DeployToken = {
        containerNames: ['docker-deploy-api-test'],
        action: DeployTokenAction.RESTART,
        cleanup: false,
    };
    deployToken = await generateDeployToken(tokenCofig, '1min');
    expect(deployToken).toBeTruthy();
    expect(deployToken.length).toBeGreaterThan(0);
});

test('HTTP POST /v1/deploy (restart)', async () => {
    const response = await app.request('/v1/deploy', {
        method: 'POST',
        headers: {
            'X-Deploy-Token': deployToken,
        },
    });
    expect(response.status).toEqual(200);
});

test('Check restarted container', async () => {
    await checkContainer({ restarted: true });
});

test('Generate deploy token (recreate)', async () => {
    const tokenCofig: DeployToken = {
        containerNames: ['docker-deploy-api-test'],
        action: DeployTokenAction.RECREATE,
        cleanup: false,
    };
    deployToken = await generateDeployToken(tokenCofig, '1min');
    expect(deployToken).toBeTruthy();
    expect(deployToken.length).toBeGreaterThan(0);
});

test('HTTP POST /v1/deploy (recreate)', async () => {
    const response = await app.request('/v1/deploy', {
        method: 'POST',
        headers: {
            'X-Deploy-Token': deployToken,
        },
    });
    expect(response.status).toEqual(200);
});

test('Check recreated container', async () => {
    await checkContainer({ recreated: true });
});

test('Get own container id should be undefined', async () => {
    const containerID = await getOwnContainerID();
    expect(containerID).toBeUndefined();
});

afterAll(async () => {
    if (testContainer) {
        await testContainer.stop();
        await testContainer.remove({ force: true });
    }
});
