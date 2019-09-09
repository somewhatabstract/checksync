// @flow
import type {MarkersProcessor, MarkerCache, ILog} from "./types.js";

const processFix: MarkersProcessor = function(
    cache: MarkerCache,
    log: ILog,
): void {
    // TODO: Fixing must be from the bottom of the file up so that line numbers
    //       don't change on us
    // TODO: Can we sync a marker within the same file? Not really since there could be multiple;
    //       how would we manage that? Let's ban it.
};

export default processFix;
