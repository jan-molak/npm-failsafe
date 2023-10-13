import { Failsafe } from './Failsafe';
import { ConsoleLogger } from './logger';

export async function run(arguments_: string[]): Promise<number> {
    const failsafe = new Failsafe(
        new ConsoleLogger(),
        {
            cwd: process.cwd(),
            isTTY: process.stdout.isTTY,
        },
        process.env
    );

    return failsafe.run(arguments_);
}
