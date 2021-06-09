// @flow
/**
 * Exit codes that can be exited with.
 */
const exitCodes = {
    SUCCESS: 0,
    NO_FILES: 1,
    PARSE_ERRORS: 2,
    DESYNCHRONIZED_BLOCKS: 3,
    UNKNOWN_ARGS: 4,
    CATASTROPHIC: 5,
};

export type ExitCode = $Values<typeof exitCodes>;

export default exitCodes;
