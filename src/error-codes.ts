export const errorCodes = Object.freeze({
    couldNotParse: "could-not-parse",
    malformedStartTag: "malformed-start-tag",
    malformedEndTag: "malformed-end-tag",
    endTagWithoutStartTag: "end-tag-without-start-tag",

    emptyMarker: "empty-marker",
    duplicateMarker: "duplicate-marker",
    startTagWithoutEndTag: "start-tag-witout-end-tag",

    mismatchedChecksum: "mismatched-checksum",
    duplicateTarget: "duplicate-target",
    startTagAfterContent: "start-tag-after-content",
    fileDoesNotExist: "file-does-not-exist",
    noReturnTag: "no-return-tag",
    selfTargeting: "self-targeting",
    differentCommentSyntax: "different-comment-syntax",
});

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];

export default errorCodes;
