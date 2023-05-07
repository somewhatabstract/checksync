import path from "path";

const normalizeSeparators = (g: string): string => g.split(path.sep).join("/");

export default normalizeSeparators;
