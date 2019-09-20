// @flow
/**
 * Error codes that can be exited with.
 */
const errorCodes = {
    SUCCESS: 0,
    NO_FILES: 1,
    PARSE_ERRORS: 2,
    DESYNCHRONIZED_BLOCKS: 3,
    UNKNOWN_ARGS: 4,
};

export type ErrorCode = $Values<typeof errorCodes>;

export default errorCodes;
