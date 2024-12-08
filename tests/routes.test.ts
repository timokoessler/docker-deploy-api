import type { Hono } from 'hono';
import { initServer } from './test-helpers';

let app: Hono;

process.env.NODE_ENV = 'TEST';
process.env.PORT = '3000';
process.env.IP = '127.0.0.1';
process.env.DISABLE_INDEX_PAGE = 'true';

beforeAll(async () => {
    app = await initServer();
});

test('HTTP GET /', async () => {
    const response = await app.request('/', {
        method: 'GET',
    });
    expect(response.status).toEqual(204);
});

test('HTTP GET /test', async () => {
    const response = await app.request('/', {
        method: 'GET',
    });
    expect(response.status).toEqual(204);
    expect(response.headers.get('access-control-allow-origin')).toEqual('*');
    expect(response.headers.get('access-control-allow-methods')).toEqual(
        'GET, POST, OPTIONS, HEAD',
    );
    expect(response.headers.get('access-control-allow-headers')).toEqual(
        'x-deploy-token',
    );
});

test('HTTP GET /robots.txt', async () => {
    const response = await app.request('/robots.txt', {
        method: 'GET',
    });
    expect(response.status).toEqual(200);
    expect(response.headers.get('content-type')).toEqual(
        'text/plain; charset=UTF-8',
    );
    expect(await response.text()).toEqual('User-agent: *\nDisallow: /');
});

test('HTTP GET /logo.svg', async () => {
    const response = await app.request('/logo.svg', {
        method: 'GET',
    });
    expect(response.status).toEqual(200);
    expect(response.headers.get('content-type')).toEqual(
        'image/svg+xml; charset=UTF-8',
    );
});

test('HTTP GET /s', async () => {
    const response = await app.request('/s', {
        method: 'GET',
    });
    expect(response.status).toEqual(200);
    expect(response.headers.get('content-type')).toEqual(
        'text/plain; charset=UTF-8',
    );
    const text = await response.text();
    expect(text).toContain('url="http://127.0.0.1:3000/v1/deploy"');
    expect(text).toContain('curl -X POST');
    expect(text).not.toContain('{{');
});

test('HTTP GET /pwsh', async () => {
    const response = await app.request('/pwsh', {
        method: 'GET',
    });
    expect(response.status).toEqual(200);
    expect(response.headers.get('content-type')).toEqual(
        'text/plain; charset=UTF-8',
    );
    const text = await response.text();
    expect(text).toContain('$url = "http://127.0.0.1:3000/v1/deploy"');
    expect(text).toContain('Invoke-RestMethod');
    expect(text).not.toContain('{{');
});
