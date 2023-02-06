import { Failsafe } from './failsafe';
import { ConsoleLogger } from './logger';

export async function run(scripts: string[]): Promise<number> {
    const failsafe = new Failsafe(new ConsoleLogger(), {
        cwd: process.cwd(),
    });

    return failsafe.run(scripts.map(script => script.trim()));
}
