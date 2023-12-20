// @ts-expect-error Wrong type definitions
import { MultiSelect } from 'enquirer';
import { getContainerInfoList, initDocker } from './core/docker';
import ora from 'ora';

(async () => {
    console.log('🐋 Docker Deploy CLI by Timo Kössler');
    const spinner = ora('Connecting to Docker socket').start();
    if (!(await initDocker(true))) {
        spinner.fail('Failed to connect to Docker socket');
        process.exit(1);
    }
    spinner.succeed('Connected to Docker socket');
    spinner.text = 'Fetching container info';
    const containers = await getContainerInfoList();
    if (!Array.isArray(containers) || containers.length === 0) {
        spinner.fail('No containers found');
        process.exit(1);
    }
    spinner.succeed(`Found ${containers.length} containers`);

    const prompt = new MultiSelect({
        name: 'value',
        message:
            'Select one or multiple containers for which you want to generate a deploy token by pressing space. Press enter when done.',
        choices: containers.map((container) => {
            return {
                name: container.Names[0].replace('/', ''),
                value: container.Id,
            };
        }),
    });

    const selectedContainers = await prompt.run();
    if (selectedContainers.length === 0) {
        spinner.fail('No containers selected');
        process.exit(1);
    }
    console.log(selectedContainers);
})();
