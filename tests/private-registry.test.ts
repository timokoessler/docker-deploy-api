import { initServer } from './test-helpers';
import {
    getContainerRegistryAuth,
    getContainerRegistryHost,
    pullImage,
} from '../src/core/docker';

process.env.NODE_ENV = 'TEST';
process.env.PORT = '3000';
process.env.IP = '127.0.0.1';

beforeAll(async () => {
    await initServer();
});

test('Get container registry host', () => {
    const host = getContainerRegistryHost('test/test:latest');
    expect(host).toEqual('docker.io');
});

test('Get container registry auth for registry.example.com', async () => {
    const auth = await getContainerRegistryAuth(
        'registry.example.com/test/test:latest',
    );

    expect(auth.username).toEqual('docker');
    expect(auth.password).toEqual('secretpassword');
});

test('Get non-existing container registry auth', async () => {
    const auth = await getContainerRegistryAuth(
        'registry.example.com:5000/test/test:latest',
    );
    expect(auth).toBeUndefined();
});

test('Get container registry auth for registry2.example.com', async () => {
    const auth = await getContainerRegistryAuth(
        'registry2.example.com/test/test:latest',
    );

    expect(auth.username).toEqual('test');
    expect(auth.password).toEqual('test2');
});

test('Pull image from private registry without auth', async () => {
    process.env.EXPECT_ERROR = 'true';
    try {
        await pullImage('registry.gitlab.com/timokoessler/busybox:latest');
        expect(false).toBeTruthy();
    } catch {
        // Expected error
    }
    process.env.EXPECT_ERROR = '';
});

if (process.env.GITLAB_AUTH_TOKEN) {
    test('Pull image from private registry with auth', async () => {
        await pullImage('registry.gitlab.com/timokoessler/busybox:latest', {
            username: 'TimoKoessler',
            password: process.env.GITLAB_AUTH_TOKEN!,
        });
    });
}
