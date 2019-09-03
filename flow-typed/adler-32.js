declare module "adler-32" {
    declare module.exports: {
        /** Version string */
        version: string,

        /** Process a node buffer or byte array */
        buf: (data: number[] | Uint8Array, seed?: number) => number,

        /** Process a binary string */
        bstr: (data: string, seed?: number) => number;

        /** Process a JS string based on the UTF8 encoding */
        str: (data: string, seed?: number) => number;
    }
}
