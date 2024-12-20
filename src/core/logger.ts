import chalk from 'chalk';
import { isDev, isTest } from './helpers';

export function log(
    level: 'error' | 'warn' | 'info' | 'debug',
    content: string | object,
) {
    /* istanbul ignore else  */
    if (isTest()) {
        if (level === 'error' && process.env.EXPECT_ERROR !== 'true') {
            throw new Error(content.toString());
        }
    } else {
        let txt: string;
        if (typeof content === 'string') {
            txt = content;
        } else {
            try {
                txt = JSON.stringify(content);
            } catch {
                txt = content.toString();
            }
        }

        // Remove newline characters to protect against crlf injection
        txt = txt.replaceAll(/(\r\n|\n|\r)/gm, '');

        const dateStr = new Date().toISOString();

        if (level === 'error') {
            console.error(`${dateStr} - ${chalk.bgRed('ERROR')}: ${txt}`);
        } else if (level === 'warn') {
            console.warn(`${dateStr} - ${chalk.yellow('WARN')}: ${txt}`);
        } else if (level === 'info') {
            console.info(`${dateStr} - ${chalk.blue('INFO')}: ${txt}`);
        } else if (isDev()) {
            console.log(`${dateStr} - DEBUG: ${txt}`);
        }
    }
}
