// @flow
import type {Middleware, MiddlewareDatum} from "./types.js";

export default class JsonMiddleware implements Middleware {
    _data: Array<MiddlewareDatum>;

    constructor() {
        this._data = [];
    }

    process(datum: MiddlewareDatum): ?MiddlewareDatum {
        this._data.push(datum);

        // Returning null prevents following middlewares from running as well
        // as the usually logging from occurring.
        return null;
    }

    output(): string {
        return JSON.stringify(this._data, null, 4);
    }
}
