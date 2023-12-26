// @ts-expect-error Wrong type definitions
import { Select } from 'enquirer';
import { cliGenerateToken } from './cli/generateToken';
import { cliRevokeToken } from './cli/revokeToken';
import { cliAddRegistryAuth } from './cli/addRegistryAuth';

(async () => {
    console.log('🐳 Docker Deploy CLI by Timo Kössler');

    const actionPrompt = new Select({
        name: 'value',
        message: 'What do you want to do?',
        choices: [
            { name: 'Generate a Deploy Token' },
            { name: 'Add registry login data' },
            { name: 'Revoke a Deploy Token' },
            { name: 'Exit' },
        ],
        initial: 0,
    });

    try {
        const action = await actionPrompt.run();

        switch (action) {
            case 'Generate a Deploy Token':
                await cliGenerateToken();
                break;
            case 'Add registry login data':
                await cliAddRegistryAuth();
                break;
            case 'Revoke a Deploy Token':
                await cliRevokeToken();
                break;
            case 'Exit':
                process.exit(0);
        }
    } catch (err) {
        if (err) {
            console.error(err.message);
        }
        process.exit(1);
    }
})();
