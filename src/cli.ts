// @ts-expect-error Wrong type definitions
import { MultiSelect, Toggle, Input, Select } from 'enquirer';
import { getContainerInfoList, getOwnContainerID, initDocker } from './core/docker';
import ora from 'ora';
import { DeployToken, DeployTokenAction } from './types';
import { generateDeployToken, initPaseto, setupPaseto } from './core/tokens';

(async () => {
    console.log('🐳 Docker Deploy CLI by Timo Kössler');
    const spinner = ora('Connecting to Docker socket').start();
    try {
        if (!(await initDocker(true))) {
            spinner.fail(
                'Failed to connect to Docker socket. Please make sure Docker is running and you have the correct permissions to access the socket.',
            );
            process.exit(1);
        }
        spinner.succeed('Connected to Docker socket');
        spinner.text = 'Fetching container info';
        let containers = await getContainerInfoList();
        if (!Array.isArray(containers) || containers.length === 0) {
            spinner.fail('No containers found');
            process.exit(1);
        }
        const ownContainerID = await getOwnContainerID();

        containers = containers.filter((container) => container.Id !== ownContainerID);

        if (containers.length === 0) {
            spinner.fail('No containers found (excluding self)');
            process.exit(1);
        }

        spinner.succeed(
            `Found ${containers.length} container${containers.length === 1 ? '' : 's'}${ownContainerID ? ' (excluding self)' : ''}`,
        );

        const prompt = new MultiSelect({
            name: 'value',
            message:
                'Select one or multiple containers for which you want to generate a deploy token by pressing space. Press enter when done',
            choices: containers.map((container) => {
                return {
                    name: container.Names[0].replace('/', ''),
                    value: container.Id,
                };
            }),
        });

        const selectedContainerNames = await prompt.run();
        if (selectedContainerNames.length === 0) {
            spinner.fail('No containers selected');
            process.exit(1);
        }

        spinner.succeed(`Selected ${selectedContainerNames.length} container${selectedContainerNames.length === 1 ? '' : 's'}`);

        const tokenConfig: DeployToken = {
            containerNames: selectedContainerNames,
            action: DeployTokenAction.PULL_AND_RECREATE,
            cleanup: true,
        };
        let tokenExpiration = '999y';

        const expirePrompt = new Toggle({
            message: 'Should the deploy token expire?',
            enabled: 'Yes',
            disabled: 'No',
            initial: true,
        });

        const shouldExpire = await expirePrompt.run();

        if (shouldExpire) {
            const expirePrompt = new Input({
                message: 'How long should the deploy token be valid?',
                initial: '12m',
                validate: (input) => {
                    if (/^(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)$/i.test(input)) {
                        return true;
                    }
                    return 'Please enter a valid duration (e.g. 12m, 1h, 30s)';
                },
            });
            tokenExpiration = await expirePrompt.run();
        }

        const actionPrompt = new Select({
            name: 'value',
            message: 'What action should the token perform?',
            choices: [{ name: 'Pull and recreate' }, { name: 'Recreate only' }, { name: 'Restart container' }],
            initial: 0,
        });

        const selectedActionName = (await actionPrompt.run()) as string;
        switch (selectedActionName) {
            case 'Pull and recreate':
                tokenConfig.action = DeployTokenAction.PULL_AND_RECREATE;
                break;
            case 'Recreate only':
                tokenConfig.action = DeployTokenAction.RECREATE;
                break;
            case 'Restart container':
                tokenConfig.action = DeployTokenAction.RESTART;
                break;
            default:
                spinner.fail('Invalid action selected');
                process.exit(1);
        }

        if (tokenConfig.action === DeployTokenAction.PULL_AND_RECREATE) {
            const cleanupPrompt = new Toggle({
                message: 'Should the old image be removed after pulling the new one?',
                enabled: 'Yes',
                disabled: 'No',
                initial: true,
            });
            tokenConfig.cleanup = await cleanupPrompt.run();
        } else {
            tokenConfig.cleanup = false;
        }

        spinner.text = 'Generating token';

        await setupPaseto();
        await initPaseto();

        const deployToken = await generateDeployToken(tokenConfig, tokenExpiration);

        spinner.succeed('Token generated. You can now save it as a secret in your CI/CD system.');
        console.log(deployToken);
        process.exit(0);

        // Todo: Add link to example GitHub action
    } catch (err) {
        spinner.fail(`Error: ${err.message}`);
        process.exit(1);
    }
})();
