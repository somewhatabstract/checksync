// flow-typed signature: 045e3888a6e1a621990262b9a98adc35
// flow-typed version: c6154227d1/minimatch_v3.x.x/flow_>=v0.104.x

type $npm$minimatch$Options = {
  debug?: boolean,
  nobrace?: boolean,
  noglobstar?: boolean,
  dot?: boolean,
  noext?: boolean,
  nocase?: boolean,
  nonull?: boolean,
  matchBase?: boolean,
  nocomment?: boolean,
  nonegate?: boolean,
  flipNegate?: boolean,
  ...
};

declare module "minimatch" {
  declare class Minimatch {
    constructor(pattern: string, options?: $npm$minimatch$Options): Minimatch,
    set: Array<Array<string | RegExp>>,
    regexp: null | RegExp, // null until .makeRe() is called
    negate: boolean,
    comment: boolean,
    empty: boolean,
    makeRe(): RegExp | false,
    match(name: string): boolean,
    matchOne(
      fileArray: Array<string>,
      patternArray: Array<string>,
      partial?: boolean
    ): boolean
  }

  declare class MinimatchModule {
    Minimatch: Class<Minimatch>,

    (name: string, pattern: string, options?: $npm$minimatch$Options): boolean,

    filter(
      pattern: string,
      options?: $npm$minimatch$Options
    ): (value: string) => boolean,

    match(
      list: Array<string>,
      pattern: string,
      options?: $npm$minimatch$Options
    ): Array<string>
  }

  declare module.exports: MinimatchModule;
}
