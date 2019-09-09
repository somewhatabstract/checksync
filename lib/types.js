// @flow

// const exampleMarkersA = {
//     filea: {
//         markerA: {
//             fixable: true,
//             checksum: "345678", // The actual checksum
//             targets: [
//                 { line: 10, file: "fileb", checksum: "2345678" /* What this file thinks this checksum should be for this marker */  },
//                 { line: 104, file: "filec", checksum: "2345678" },
//             ],
//         },
//     },
// };

export interface ILog {
    +errorsLogged: boolean;

    +group: (...labels: Array<string>) => void;
    +groupEnd: () => void;

    +error: (message: string, skipFormat?: boolean) => void;
    +info: (message: string) => void;
    +log: (message: string) => void;
    +warn: (message: string) => void;
}

/**
 * A marker target.
 */
export type Target = {
    /**
     * The file that a marker references.
     */
    +file: string,

    /**
     * The checksum that a marker has recorded for the target marker.
     * The mismatch between this and the target marker's actual checksum is
     * what we will pick up and report/fix.
     */
    +checksum: string,
};

/**
 * Target declarations by the line on which the declaration exists.
 * This is the line that will need to be updated if the target checksum
 * is incorrect.
 */
export type Targets = {
    [line: number]: Target,
};

/**
 * A marker.
 */
export type Marker = {
    /**
     * Indicates if this marker's checksum can be updated during fixing.
     */
    +fixable: boolean,

    /**
     * The actual checksum value of the marker content.
     */
    +checksum: string,

    /**
     * The targets that the marker syncs with.
     */
    +targets: Targets,
};

/**
 * A map of markers.
 */
export type Markers = {
    /**
     * Marker id to the marker details.
     */
    [id: string]: Marker,
};

/**
 * All the markers we're working with as a map from filepath to its markers.
 */
export type MarkerCache = {
    /**
     * A file path mapped to the markers within it.
     */
    [file: string]: Markers,
};

export type MarkersProcessor = (markers: MarkerCache, log: ILog) => void;
