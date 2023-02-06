import { Failsafe } from './failsafe';
import { ConsoleLogger } from './logger';

export function run(scripts: string[]): Promise<number> {
    if (scripts.length === 0) {
        // tslint:disable-next-line:no-console
        console.error(
            `Please specify which npm scripts you'd like to run, for example:\n`,
            `  npm failsafe start test`,
        );
    }

    const failsafe = new Failsafe(new ConsoleLogger(), {
        cwd: process.cwd(),
    });

    return failsafe.run(scripts.map(script => script.trim()));
}
