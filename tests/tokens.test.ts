import express from 'express';
import { initServer, sleep } from './test-helpers';
import request from 'supertest';
import { DeployToken, DeployTokenAction } from '../src/types';
import { generateDeployToken } from '../src/core/tokens';

let app: express.Application;
let deployToken = '';

process.env.NODE_ENV = 'TEST';
process.env.PORT = '3000';
process.env.IP = '127.0.0.1';

const revokedToken =
    'v4.public.eyJjb250YWluZXJOYW1lcyI6WyJub24tZXhpc3RpbmctY29udGFpbmVyLWFiYyJdLCJhY3Rpb24iOjAsImNsZWFudXAiOnRydWUsImlhdCI6IjIwMjQtMDEtMTRUMTE6MDU6NTUuNjEzWiIsImV4cCI6IjMwMjMtMDEtMjJUMDU6MDU6NTUuNjEzWiJ9XS8OxoWALxCFRJfBEvksNe5V6OyJiL7JL6nf4NdMxp_d3ifuc5mZYPxS1XEge2uATv9U8HJKRNUl_vs7gGvRAQ';

beforeAll(async () => {
    app = await initServer();
});

test('Generate deploy token', async () => {
    const tokenCofig: DeployToken = {
        containerNames: ['non-existing-container-abc'],
        action: DeployTokenAction.PULL_AND_RECREATE,
        cleanup: true,
    };
    deployToken = await generateDeployToken(tokenCofig, '5seconds');
    expect(deployToken).toBeTruthy();
    expect(deployToken.length).toBeGreaterThan(0);
});

test('HTTP POST /v1/deploy (token with non-existing container)', async () => {
    const response = await request(app).post('/v1/deploy').set('X-Deploy-Token', deployToken);

    expect(response.status).toEqual(404);
    expect(response.text).toEqual('Error: Can not find container info for non-existing-container-abc');
});

test('Wait until token expires', async () => {
    await sleep(5500);
});

test('HTTP POST /v1/deploy (expired token)', async () => {
    const response = await request(app).post('/v1/deploy').set('X-Deploy-Token', deployToken);

    expect(response.status).toEqual(401);
    expect(response.text).toEqual('Error: Invalid deploy token');
});

test('HTTP POST /v1/deploy (revoked token)', async () => {
    const response = await request(app).post('/v1/deploy').set('X-Deploy-Token', revokedToken);

    expect(response.status).toEqual(401);
    expect(response.text).toEqual('Error: Deploy token has been revoked');
});

test('HTTP POST /v1/deploy (expired token)', async () => {
    const response = await request(app).post('/v1/deploy').set('X-Deploy-Token', deployToken);

    expect(response.status).toEqual(401);
    expect(response.text).toEqual('Error: Invalid deploy token');
});

test('HTTP POST /v1/deploy (no token)', async () => {
    const response = await request(app).post('/v1/deploy');

    expect(response.status).toEqual(401);
    expect(response.text).toEqual('Error: Missing X-Deploy-Token header');
});

test('Generate deploy token without container names', async () => {
    const tokenCofig: DeployToken = {
        containerNames: [],
        action: DeployTokenAction.PULL_AND_RECREATE,
        cleanup: true,
    };
    deployToken = await generateDeployToken(tokenCofig, '15seconds');
    expect(deployToken).toBeTruthy();
    expect(deployToken.length).toBeGreaterThan(0);
});

test('HTTP POST /v1/deploy (token without container names)', async () => {
    const response = await request(app).post('/v1/deploy').set('X-Deploy-Token', deployToken);

    expect(response.status).toEqual(400);
    expect(response.text).toEqual('Error: No container names specified');
});

test('Generate deploy token without action', async () => {
    const tokenCofig: DeployToken = {
        containerNames: ['docker-deploy-api-test'],
        // @ts-expect-error Testing invalid action
        action: undefined,
        cleanup: true,
    };
    deployToken = await generateDeployToken(tokenCofig, '15seconds');
    expect(deployToken).toBeTruthy();
    expect(deployToken.length).toBeGreaterThan(0);
});

test('HTTP POST /v1/deploy (token without action)', async () => {
    const response = await request(app).post('/v1/deploy').set('X-Deploy-Token', deployToken);

    expect(response.status).toEqual(400);
    expect(response.text).toEqual('Error: No or invalid action specified');
});
