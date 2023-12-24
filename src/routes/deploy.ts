import express from 'express';
import { verifyDeployToken } from '../core/tokens';
import { DeployToken, DeployTokenAction } from '../types';
import {
    getContainerByID,
    getContainerInfoList,
    getContainerRegistryAuth,
    getDockerImage,
    pullImage,
    recreateContainer,
    restartContainer,
} from '../core/docker';
import { Container, ContainerInfo } from 'dockerode';
import { log } from '../core/logger';

export function setupDeployRoutes(app: express.Application) {
    app.post('/v1/deploy', async (req, res) => {
        try {
            // Check if the request has the correct deploy token
            const deployToken = req.header('X-Deploy-Token');
            if (typeof deployToken !== 'string' || !deployToken.length) {
                res.status(401).send('Error: Missing X-Deploy-Token header');
                return;
            }
            const token = (await verifyDeployToken(deployToken)) as DeployToken;
            if (!token) {
                log('warn', `Received request with invalid deploy token from ${req.ip}`);
                res.status(401).send('Error: Invalid X-Deploy-Token header');
                return;
            }

            // Validate the token contents
            if (Array.isArray(token.containerNames) && !token.containerNames.length) {
                res.status(400).send('Error: No container names specified');
                return;
            }
            if (typeof token.action !== 'number' || token.action < 0 || token.action > 2) {
                res.status(400).send('Error: No or invalid action specified');
                return;
            }

            // Get the container info for all containers
            const containerInfos = await getContainerInfoList();
            if (!containerInfos) {
                res.status(500).send('Error: Failed to list containers');
                return;
            }

            // Get the container objects for all containers that should be deployed and put them in a list
            const deployContainerList: { container: Container; info: ContainerInfo }[] = [];
            for (const containerName of token.containerNames) {
                const containerInfo = containerInfos.find((c) => c.Names[0] === `/${containerName}`);
                if (!containerInfo) {
                    res.status(404).send(`Error: Can not find container info for ${containerName}`);
                    log('error', `Can not find container info for ${containerName}`);
                    return;
                }
                const container = await getContainerByID(containerInfo.Id);
                if (!container) {
                    res.status(404).send(`Error: Container ${containerName} not found`);
                    return;
                }
                deployContainerList.push({ container, info: containerInfo });
            }

            let logOutput = '';
            const logAndSave = (level: 'error' | 'warn' | 'info' | 'debug', content: string) => {
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
                    logAndSave('info', `Pulling image for container ${containerName}`);
                    const oldImageID = info.ImageID;
                    try {
                        const auth = await getContainerRegistryAuth(info.Image);
                        await pullImage(info.Image, auth);
                    } catch (error) {
                        logAndSave('error', `Failed to pull image for container ${containerName}: ${error.message}`);
                        res.status(500).send(logOutput);
                        return;
                    }

                    logAndSave('info', `Recreating container ${containerName}`);
                    if (!(await recreateContainer(container))) {
                        logAndSave('error', `Failed to recreate container ${containerName}`);
                        res.status(500).send(logOutput);
                        return;
                    }

                    // Remove the old image
                    if (token.cleanup) {
                        const containerInfos = await getContainerInfoList();
                        if (!containerInfos) {
                            logAndSave('error', 'Failed to list containers. Skipping cleanup.');
                            continue;
                        }
                        const containerInfo = containerInfos.find((c) => c.Names[0] === `/${containerName}`);
                        if (!containerInfo) {
                            logAndSave('error', `Failed to get container info for container ${containerName}. Skipping cleanup.`);
                            continue;
                        }
                        if (containerInfo.ImageID !== oldImageID) {
                            logAndSave('info', `Removing old image for container ${containerName}`);
                            const oldImage = getDockerImage(oldImageID);
                            if (!oldImage) {
                                logAndSave('error', `Failed to get old Docker Image for ${containerName}. Skipping cleanup.`);
                                continue;
                            }
                            try {
                                await oldImage.remove();
                            } catch (error) {
                                logAndSave('error', `Failed to remove old image for container ${containerName}: ${error.message}`);
                                continue;
                            }
                            logAndSave('info', `Successfully removed old image for container ${containerName}`);
                        } else {
                            logAndSave('info', 'No new image pulled. Skipping cleanup.');
                        }
                    }
                    logAndSave('info', `Successfully pulled and recreated container ${containerName}`);
                } else if (token.action === DeployTokenAction.RECREATE) {
                    logAndSave('info', `Recreating container ${containerName}`);
                    if (!(await recreateContainer(container))) {
                        logAndSave('error', `Failed to recreate container ${containerName}`);
                        res.status(500).send(logOutput);
                        return;
                    }
                    logAndSave('info', `Successfully recreated container ${containerName}`);
                } else if (token.action === DeployTokenAction.RESTART) {
                    logAndSave('info', `Restarting container ${containerName}`);
                    if (!(await restartContainer(container))) {
                        logAndSave('error', `Failed to restart container ${containerName}`);
                        res.status(500).send(logOutput);
                        return;
                    }
                    logAndSave('info', `Successfully restarted container ${containerName}`);
                }
            }
            logAndSave('info', 'Successfully deployed all containers');
            res.status(200).send(logOutput);
        } catch (error) {
            log('error', `Failed to deploy containers: ${error.message}`);
            if (!res.headersSent) {
                res.status(500).send('Internal server error. View logs for more information.');
            }
        }
    });
}
