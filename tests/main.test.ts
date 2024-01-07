import express from 'express';
import request from 'supertest';
import { initServer, sleep } from './test-helpers';
import { Container } from 'dockerode';
import { createDockerTestContainer } from './test-helpers';
import { getContainerByID, getContainerInfoList, getDockerImage, pullImage } from '../src/core/docker';
import { DeployToken, DeployTokenAction } from '../src/types';
import { generateDeployToken } from '../src/core/tokens';

let app: express.Application;
let deployToken = '';
let testContainer: Container;
let imageHash: string;

process.env.NODE_ENV = 'test';

beforeAll(async () => {
    app = await initServer();
});

/**
 * Checks if the test container is running and has the correct properties
 */
async function checkContainer() {
    const containers = await getContainerInfoList();
    expect(containers).toBeTruthy();
    expect(containers!.length).toBeGreaterThan(0);

    const container = containers!.find((c) => c.Names[0] === '/docker-deploy-api-test');
    expect(container).toBeTruthy();
    expect(container!.Image).not.toBe(imageHash);

    testContainer = getContainerByID(container!.Id) as Container;
    expect(testContainer).toBeTruthy();

    const containerInfo = await testContainer.inspect();
    expect(containerInfo.State.Running).toBe(true);
    expect(containerInfo.Name).toBe('/docker-deploy-api-test');
    expect(containerInfo.Config.Cmd).toEqual(['tail', '-f', '/dev/null']);
    expect(containerInfo.Config.Labels['docker-deploy-api']).toBe('test');
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
    const containerInfo = await testContainer.inspect();
    expect(containerInfo.State.Running).toBe(true);
    expect(containerInfo.Name).toBe('/docker-deploy-api-test');
    expect(containerInfo.Config.Cmd).toEqual(['tail', '-f', '/dev/null']);
    expect(containerInfo.Config.Labels['docker-deploy-api']).toBe('test');

    imageHash = containerInfo.Image;
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

test('HTTP POST /v1/deploy', async () => {
    return request(app).post('/v1/deploy').set('X-Deploy-Token', deployToken).timeout(20000).expect(200);
});

test('Check recreated container', async () => {
    await checkContainer();
});

afterAll(async () => {
    if (testContainer) {
        testContainer.stop();
        testContainer.remove({ force: true });
    }
});
