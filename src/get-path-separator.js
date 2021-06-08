// @flow
import path from "path";

// This function allows us to mock the path separator in the tests since
// path.sep isn't writable.
export const getPathSeparator = (): string => path.sep;
