import { isTokenRevoked, verifyDeployToken } from '../core/tokens';
import { DeployToken, DeployTokenAction } from '../types';
import {
    getContainerByID,
    getContainerInfoList,
    getContainerRegistryAuth,
    getContainerRegistryHost,
    getDockerImage,
    pullImage,
    recreateContainer,
    restartContainer,
} from '../core/docker';
import { Container, ContainerInfo } from 'dockerode';
import { log } from '../core/logger';
import type { Hono } from 'hono';
import { getIPAddressFromHono } from '../core/ip';

export function setupDeployRoutes(app: Hono) {
    app.post('/v1/deploy', async (c) => {
        try {
            // Check if the request has the correct deploy token
            const deployToken = c.req.header('X-Deploy-Token');
            if (typeof deployToken !== 'string' || deployToken.length === 0) {
                c.text('Error: Missing X-Deploy-Token header', { status: 401 });
                return;
            }
            const token = (await verifyDeployToken(deployToken)) as DeployToken;
            if (!token) {
                log(
                    'warn',
                    `Received request with invalid deploy token from ${getIPAddressFromHono(c)}`,
                );
                c.text('Error: Invalid deploy token', { status: 401 });
                return;
            }

            if (isTokenRevoked(deployToken)) {
                log(
                    'warn',
                    `Received request with revoked deploy token from ${getIPAddressFromHono(c)}`,
                );
                c.text('Error: Deploy token has been revoked', { status: 401 });
                return;
            }

            // Validate the token contents
            if (
                Array.isArray(token.containerNames) &&
                token.containerNames.length === 0
            ) {
                c.text('Error: No container names specified', { status: 400 });
                return;
            }
            if (
                typeof token.action !== 'number' ||
                token.action < 0 ||
                token.action > 2
            ) {
                c.text('Error: No or invalid action specified', {
                    status: 400,
                });
                return;
            }

            // Get the container info for all containers
            const containerInfos = await getContainerInfoList();
            if (!containerInfos) {
                c.text('Error: Failed to list containers', {
                    status: 500,
                });
                return;
            }

            // Get the container objects for all containers that should be deployed and put them in a list
            const deployContainerList: {
                container: Container;
                info: ContainerInfo;
            }[] = [];
            for (const containerName of token.containerNames) {
                const containerInfo = containerInfos.find(
                    (c) => c.Names[0] === `/${containerName}`,
                );
                if (!containerInfo) {
                    c.text(
                        `Error: Can not find container info for ${containerName}`,
                        {
                            status: 404,
                        },
                    );
                    log(
                        'warn',
                        `Can not find container info for ${containerName}`,
                    );
                    return;
                }
                const container = await getContainerByID(containerInfo.Id);
                if (!container) {
                    c.text(`Error: Container ${containerName} not found`, {
                        status: 404,
                    });
                    return;
                }
                deployContainerList.push({ container, info: containerInfo });
            }

            let logOutput = '';
            const logAndSave = (
                level: 'error' | 'warn' | 'info' | 'debug',
                content: string,
            ) => {
                log(level, content);
                if (level === 'error') {
                    content = `Error: ${content}`;
                } else if (level === 'warn') {
                    content = `Warning: ${content}`;
                }
                logOutput += `${new Date().toISOString()} - ${content}\n`;
            };

            logAndSave(
                'info',
                `Deploying container${deployContainerList.length > 1 ? 's' : ''} ${token.containerNames.join(', ')} with action ${
                    token.action
                }`,
            );

            // Deploy all containers
            for (const { container, info } of deployContainerList) {
                const containerName = info.Names[0].replace('/', '');

                // Pull and recreate the container
                if (token.action === DeployTokenAction.PULL_AND_RECREATE) {
                    logAndSave(
                        'info',
                        `Pulling image for container ${containerName}`,
                    );
                    const oldImageID = info.ImageID;
                    try {
                        const auth = await getContainerRegistryAuth(info.Image);
                        if (auth) {
                            logAndSave(
                                'info',
                                `Logging in to registry ${getContainerRegistryHost(info.Image)}`,
                            );
                        }
                        await pullImage(info.Image, auth);
                    } catch (error) {
                        logAndSave(
                            'error',
                            `Failed to pull image for container ${containerName}: ${error.message}`,
                        );
                        c.text(logOutput, {
                            status: 500,
                        });
                        return;
                    }

                    logAndSave('info', `Recreating container ${containerName}`);
                    if (!(await recreateContainer(container))) {
                        logAndSave(
                            'error',
                            `Failed to recreate container ${containerName}`,
                        );
                        c.text(logOutput, {
                            status: 500,
                        });
                        return;
                    }

                    // Remove the old image
                    if (token.cleanup) {
                        const containerInfos = await getContainerInfoList();
                        if (!containerInfos) {
                            logAndSave(
                                'error',
                                'Failed to list containers. Skipping cleanup.',
                            );
                            continue;
                        }
                        const containerInfo = containerInfos.find(
                            (c) => c.Names[0] === `/${containerName}`,
                        );
                        if (!containerInfo) {
                            logAndSave(
                                'error',
                                `Failed to get container info for container ${containerName}. Skipping cleanup.`,
                            );
                            continue;
                        }
                        if (containerInfo.ImageID === oldImageID) {
                            logAndSave(
                                'info',
                                'No new image pulled. Skipping cleanup.',
                            );
                        } else {
                            logAndSave(
                                'info',
                                `Removing old image for container ${containerName}`,
                            );
                            const oldImage = getDockerImage(oldImageID);
                            if (!oldImage) {
                                logAndSave(
                                    'error',
                                    `Failed to get old Docker Image for ${containerName}. Skipping cleanup.`,
                                );
                                continue;
                            }
                            try {
                                await oldImage.remove();
                            } catch (error) {
                                logAndSave(
                                    'error',
                                    `Failed to remove old image for container ${containerName}: ${error.message}`,
                                );
                                continue;
                            }
                            logAndSave(
                                'info',
                                `Successfully removed old image for container ${containerName}`,
                            );
                        }
                    }
                    logAndSave(
                        'info',
                        `Successfully pulled and recreated container ${containerName}`,
                    );

                    // Recreate the container without pulling the image
                } else if (token.action === DeployTokenAction.RECREATE) {
                    logAndSave('info', `Recreating container ${containerName}`);
                    if (!(await recreateContainer(container))) {
                        logAndSave(
                            'error',
                            `Failed to recreate container ${containerName}`,
                        );
                        c.text(logOutput, {
                            status: 500,
                        });
                        return;
                    }
                    logAndSave(
                        'info',
                        `Successfully recreated container ${containerName}`,
                    );

                    // Restart the container
                } else if (token.action === DeployTokenAction.RESTART) {
                    logAndSave('info', `Restarting container ${containerName}`);
                    if (!(await restartContainer(container))) {
                        logAndSave(
                            'error',
                            `Failed to restart container ${containerName}`,
                        );
                        c.text(logOutput, {
                            status: 500,
                        });
                        return;
                    }
                    logAndSave(
                        'info',
                        `Successfully restarted container ${containerName}`,
                    );
                }
            }
            logAndSave('info', 'Successfully deployed all containers');
            c.text(logOutput, {
                status: 200,
            });
        } catch (error) {
            log('error', `Failed to deploy containers: ${error.message}`);
            // if (!res.headersSent) {
            // TODO: What is the hono equivalent of this?
            c.text('Internal server error. View logs for more information.', {
                status: 500,
            });
            // }
        }
    });
}
