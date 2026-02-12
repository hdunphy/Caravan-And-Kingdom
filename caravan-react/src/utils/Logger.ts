export class Logger {
    private static instance: Logger;
    private isSilent: boolean = false;

    private constructor() { }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public setSilent(silent: boolean) {
        this.isSilent = silent;
    }

    public log(message: string, ...args: any[]) {
        if (!this.isSilent) {
            console.log(message, ...args);
        }
    }

    public warn(message: string, ...args: any[]) {
        if (!this.isSilent) {
            console.warn(message, ...args);
        }
    }

    public error(message: string, ...args: any[]) {
        console.error(message, ...args);
    }
}
