// @flow
import type {MarkersProcessor, MarkerCache, ILog} from "./types.js";

const processState: MarkersProcessor = function(
    cache: MarkerCache,
    log: ILog,
): void {
    // TODO: Can we sync a marker within the same file? Not really since there could be multiple;
    //       how would we manage that? Let's ban it.
};

export default processState;
