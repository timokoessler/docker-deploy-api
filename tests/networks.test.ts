import { initServer, sleep } from './test-helpers';
import { Container, Network } from 'dockerode';
import {
    getDockerConnection,
    pullImage,
    recreateContainer,
} from '../src/core/docker';

process.env.NODE_ENV = 'TEST';
process.env.PORT = '3000';
process.env.IP = '127.0.0.1';

const CONTAINER_NAME = 'docker-deploy-api-test-networks';
const NETWORK_1 = 'docker-deploy-api-test-net-1';
const NETWORK_2 = 'docker-deploy-api-test-net-2';

let container: Container | undefined;
let network1: Network | undefined;
let network2: Network | undefined;

beforeAll(async () => {
    await initServer();
    await pullImage('busybox:latest');
});

test('recreateContainer preserves all attached networks', async () => {
    const docker = getDockerConnection();

    network1 = await docker.createNetwork({ Name: NETWORK_1 });
    network2 = await docker.createNetwork({ Name: NETWORK_2 });

    // Create a container attached to the first network, then connect the
    // second one - a container attached to multiple networks.
    container = await docker.createContainer({
        Image: 'busybox:latest',
        name: CONTAINER_NAME,
        Labels: { 'docker-deploy-api': 'test' },
        Cmd: ['tail', '-f', '/dev/null'],
        HostConfig: { NetworkMode: NETWORK_1 },
        NetworkingConfig: {
            EndpointsConfig: {
                [NETWORK_1]: { Aliases: ['alias-one'] },
            },
        },
    });
    await network2.connect({
        Container: container.id,
        EndpointConfig: { Aliases: ['alias-two'] },
    });
    await container.start();
    await sleep(100);

    // Sanity check: both networks attached before recreation.
    const before = await container.inspect();
    expect(Object.keys(before.NetworkSettings.Networks).sort()).toEqual(
        [NETWORK_1, NETWORK_2].sort(),
    );

    const newContainer = await recreateContainer(container);
    expect(newContainer).toBeTruthy();
    container = newContainer;
    await sleep(100);

    const after = await newContainer!.inspect();
    expect(after.State.Running).toBe(true);

    // Both networks must survive the recreation, not just the first one.
    const networks = after.NetworkSettings.Networks;
    expect(Object.keys(networks).sort()).toEqual([NETWORK_1, NETWORK_2].sort());

    // Aliases must be preserved on both networks.
    expect(networks[NETWORK_1].Aliases).toContain('alias-one');
    expect(networks[NETWORK_2].Aliases).toContain('alias-two');
});

afterAll(async () => {
    if (container) {
        try {
            await container.stop();
        } catch {
            // ignore
        }
        try {
            await container.remove({ force: true });
        } catch {
            // ignore
        }
    }
    for (const network of [network1, network2]) {
        if (network) {
            try {
                await network.remove();
            } catch {
                // ignore
            }
        }
    }
});
