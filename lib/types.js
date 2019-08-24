// @flow

// const exampleMarkersA = {
//     filea: {
//         markerA: {
//             fixable: true,
//             checksum: "345678", // The actual checksum
//             start: 0,
//             end: 10,
//             targets: [
//                 { file: "fileb", checksum: "2345678" /* What this file thinks this checksum should be for this marker */  },
//                 { file: "filec", checksum: "2345678" },
//             ],
//         },
//     },
// };

/**
 * A marker target.
 */
export type Target = {
    /**
     * The file that a marker references.
     */
    file: string,

    /**
     * The checksum that a marker has recorded for the target marker.
     * The mismatch between this and the target marker's actual checksum is
     * what we will pick up and report/fix.
     */
    checksum: String,
};

/**
 * A marker.
 */
export type Marker = {
    /**
     * Indicates if this marker's checksum can be updated during fixing.
     */
    fixable: boolean,

    /**
     * The actual checksum value of the marker content.
     */
    checksum: string,

    /**
     * The start line of the marker content.
     */
    start: number,

    /**
     * The end line of the marker content.
     */
    end: number,

    /**
     * The targets that the marker syncs with.
     */
    targets: Array<Target>,
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
