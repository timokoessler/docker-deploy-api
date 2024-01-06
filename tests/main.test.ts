import express from 'express';
import { initConfig } from '../src/core/config';
import { initApp } from '../src/app';
import request from 'supertest';

let app: express.Application;

beforeAll(async () => {
    const config = initConfig();
    app = initApp(config);
});

test('...', async () => {
    return request(app).get('/').expect(200);
});
