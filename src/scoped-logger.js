// @flow
import type {ILog} from "./types.js";

type LogFn = (
    message: string,
) => void | ((message: string, skipFormat?: boolean) => void);
/**
 * Output log entries inside a scoped group, but only if something is logged.
 *
 * @export
 * @class ScopedLogger
 * @implements {ILog}
 */
export default class ScopedLogger implements ILog {
    _log: ILog;
    _scope: string;
    _groupOpened: boolean;

    log: $PropertyType<ILog, "log">;
    info: $PropertyType<ILog, "info">;
    warn: $PropertyType<ILog, "warn">;
    error: $PropertyType<ILog, "error">;
    group: $PropertyType<ILog, "group">;
    groupEnd: $PropertyType<ILog, "groupEnd">;

    constructor(scope: string, log: ILog) {
        this._log = log;
        this._scope = scope;
        this._groupOpened = false;

        this.log = this._logBind(this._log.log);
        this.info = this._logBind(this._log.info);
        this.error = this._logBind(this._log.error);
        this.warn = this._logBind(this._log.warn);
        this.group = this._logBind(this._log.group);
        this.groupEnd = this._logBind(this._log.groupEnd);
    }

    _logBind = (logFn: LogFn) => (...args: Array<any>) => {
        if (!this._groupOpened) {
            this._groupOpened = true;
            this._log.group(this._scope);
        }
        logFn(...args);
    };

    closeScope = () => {
        if (this._groupOpened) {
            this._log.groupEnd();
        }
    };

    get errorsLogged() {
        return this._log.errorsLogged;
    }
}
