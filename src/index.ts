import { Failsafe } from './Failsafe';
import { ConsoleLogger } from './logger';

export async function run(scripts: string[]): Promise<number> {
    const failsafe = new Failsafe(
        new ConsoleLogger(),
        {
            cwd: process.cwd(),
            isTTY: process.stdout.isTTY,
        },
        process.env
    );

    return failsafe.run(scripts.map(script => script.trim()));
}
