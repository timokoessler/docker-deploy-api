import express from 'express';
import request from 'supertest';
import { initServer, sleep, timeDiff } from './test-helpers';
import { Container } from 'dockerode';
import { createDockerTestContainer } from './test-helpers';
import { getContainerByID, getContainerInfoList, getDockerImage, pullImage } from '../src/core/docker';
import { DeployToken, DeployTokenAction } from '../src/types';
import { generateDeployToken } from '../src/core/tokens';

let app: express.Application;
let deployToken = '';
let testContainer: Container;
let imageHash: string;

process.env.NODE_ENV = 'TEST';

beforeAll(async () => {
    app = await initServer();
});

/**
 * Checks if the test container is running and has the correct properties
 */
async function checkContainer({ recreated = false, restarted = false, pulled = false }) {
    const containers = await getContainerInfoList();
    expect(containers).toBeTruthy();
    expect(containers!.length).toBeGreaterThan(0);

    const container = containers!.find((c) => c.Names[0] === '/docker-deploy-api-test');
    expect(container).toBeTruthy();

    testContainer = getContainerByID(container!.Id) as Container;
    expect(testContainer).toBeTruthy();

    const containerInfo = await testContainer.inspect();
    expect(containerInfo.State.Running).toBe(true);
    expect(containerInfo.Name).toBe('/docker-deploy-api-test');
    expect(containerInfo.Config.Cmd).toEqual(['tail', '-f', '/dev/null']);
    expect(containerInfo.Config.Labels['docker-deploy-api']).toBe('test');

    if (recreated) {
        expect(timeDiff(containerInfo.Created, containerInfo.State.StartedAt)).toBeLessThan(2000);
    }

    if (pulled) {
        expect(container!.Image).not.toEqual(imageHash);
    } else if (imageHash) {
        expect(container!.Image).toBe(imageHash);
    }

    if (restarted) {
        expect(timeDiff(containerInfo.Created, containerInfo.State.StartedAt)).toBeGreaterThan(3000);
    }

    imageHash = container!.Image;
}

test('HTTP GET /', async () => {
    return request(app).get('/').expect(200);
});

test('HTTP POST /v1/deploy with empty deploy token', async () => {
    return request(app).post('/v1/deploy').set('X-Deploy-Token', deployToken).expect(401);
});

test('Delete busybox 1.35.0 image', async () => {
    const image = getDockerImage('busybox:1.35.0');
    if (!image) {
        return;
    }
    try {
        await image.remove({ force: true });
    } catch (e) {
        if (!e.message.includes('No such image')) {
            throw e;
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
    } catch (e) {
        if (!e.message.includes('No such image')) {
            throw e;
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
    testContainer = await createDockerTestContainer();
    await sleep(100);
    await checkContainer({});
});

test('Generate deploy token', async () => {
    const tokenCofig: DeployToken = {
        containerNames: ['docker-deploy-api-test'],
        action: DeployTokenAction.PULL_AND_RECREATE,
        cleanup: true,
    };
    deployToken = await generateDeployToken(tokenCofig, '1min');
    expect(deployToken).toBeTruthy();
    expect(deployToken.length).toBeGreaterThan(0);
});

test('HTTP POST /v1/deploy (recreate, pull)', async () => {
    return request(app).post('/v1/deploy').set('X-Deploy-Token', deployToken).timeout(30000).expect(200);
});

test('Check recreated container', async () => {
    await checkContainer({ recreated: true, pulled: true });
});

test('Generate restart deploy token', async () => {
    const tokenCofig: DeployToken = {
        containerNames: ['docker-deploy-api-test'],
        action: DeployTokenAction.RESTART,
        cleanup: true,
    };
    deployToken = await generateDeployToken(tokenCofig, '1min');
    expect(deployToken).toBeTruthy();
    expect(deployToken.length).toBeGreaterThan(0);
});

test('HTTP POST /v1/deploy (restart)', async () => {
    return request(app).post('/v1/deploy').set('X-Deploy-Token', deployToken).timeout(30000).expect(200);
});

test('Check restarted container', async () => {
    await checkContainer({ restarted: true });
});

afterAll(async () => {
    if (testContainer) {
        await testContainer.stop();
        await testContainer.remove({ force: true });
    }
});
