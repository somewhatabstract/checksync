declare module "@hyperjump/json-schema" {
    declare opaque type Schema;

    declare type SDoc = {
        anchors: mixed,
        dynamicAnchors: mixed,
        id: string,
        pointer: string,
        schema: Schema,
        schemaVersion: string,
        validated: boolean,
        value: Schema,
        vocabulary: mixed,
    };

    declare opaque type Keywords;

    declare type OutputFormat = "FLAG" | "BASIC" | "DETAILED" | "VERBOSE";

    declare type OutputUnit = {
        absoluteKeywordLocation: string,
        errors: $ReadOnlyArray<OutputUnit>,
        instanceLocation: string,
        keyword: string,
        valid: boolean,
    };

    declare type AST = mixed;

    declare type CompiledSchema = {
        ast: AST,
        schemaUri: string,
    };

    declare interface JsonSchema {
        add: (schema: SDoc, url?: string, defaultSchemaVersion?: string) => void,
        get: (url: string, contextDoc?: SDoc) => Promise<SDoc>,
        validate: (schema: SDoc, value: {...}, outputFormat?: OutputFormat) => Promise<OutputUnit>,
        compile: (schema: SDoc) => Promise<CompiledSchema>;
        interpret: interface {
            (schema: CompiledSchema, value: {...}): (outputFormat?: OutputFormat) => OutputUnit;
            (schema: CompiledSchema): (value: {...}, outputFormat?: OutputFormat) => OutputUnit;
            (schema: CompiledSchema, value: {...}, outputFormat?: OutputFormat): () =>  OutputUnit;
        },
        setMetaOutputFormat: (outputFormat?: OutputFormat) => void,
        setShouldMetaValidate: (isEnabled: boolean) => void,
        FLAG: "FLAG",
        BASIC: "BASIC",
        DETAILED: "DETAILED",
        VERBOSE: "VERBOSE",
        Keywords: Keywords
    }

    declare module.exports: JsonSchema;
}