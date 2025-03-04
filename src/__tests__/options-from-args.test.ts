import {optionsFromArgs} from "../options-from-args";

describe("#optionsFromArgs", () => {
    it("should not add includeGlobs if args._ is not provided", () => {
        // Arrange
        const args: any = {
            _: null,
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.includeGlobs).not.toBeDefined();
    });

    it("should not add includeGlobs if args._ has length 0", () => {
        // Arrange
        const args: any = {
            _: [],
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.includeGlobs).not.toBeDefined();
    });

    it("should add includeGlobs if there are items in args._", () => {
        // Arrange
        const args: any = {
            _: ["foo", "bar"],
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.includeGlobs).toEqual(["foo", "bar"]);
    });

    it("should not add excludeGlobs if args.ignore is not provided", () => {
        // Arrange
        const args: any = {
            ignore: null,
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.excludeGlobs).not.toBeDefined();
    });

    it.each([
        ["", []],
        ["ex1;ex2;", ["ex1", "ex2"]],
    ])(
        'should add excludeGlobs="%s" if args.ignore is %s',
        (ignore, expectation) => {
            // Arrange
            const args: any = {
                ignore,
            };

            // Act
            const result = optionsFromArgs(args);

            // Assert
            expect(result.excludeGlobs).toEqual(expectation);
        },
    );

    it("should not add ignoreFiles if args.ignoreFiles is not provided", () => {
        // Arrange
        const args: any = {
            ignoreFiles: null,
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.ignoreFiles).not.toBeDefined();
    });

    it("should set ignoreFiles to empty array if args.ignoreFiles is false", () => {
        // Arrange
        const args: any = {
            ignoreFiles: false,
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.ignoreFiles).toBeEmpty();
    });

    it.each([
        ["", []],
        ["ex1;ex2;", ["ex1", "ex2"]],
    ])(
        'should add ignoreFiles="%s" if args.ignoreFiles is %s',
        (ignoreFiles, expectation) => {
            // Arrange
            const args: any = {
                ignoreFiles,
            };

            // Act
            const result = optionsFromArgs(args);

            // Assert
            expect(result.ignoreFiles).toEqual(expectation);
        },
    );

    it("should not add autoFix if args.updateTags is not provided", () => {
        // Arrange
        const args: any = {
            updateTags: null,
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.autoFix).not.toBeDefined();
    });

    it("should add autoFix if args.updateTags is provided", () => {
        // Arrange
        const args: any = {
            updateTags: true,
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.autoFix).toBe(true);
    });

    it("should not add json if args.json is not provided", () => {
        // Arrange
        const args: any = {
            json: null,
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.json).not.toBeDefined();
    });

    it("should add json if args.json is provided", () => {
        // Arrange
        const args: any = {
            json: true,
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.json).toBe(true);
    });

    it("should not add comments if args.comments is not provided", () => {
        // Arrange
        const args: any = {
            comments: null,
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.comments).not.toBeDefined();
    });

    it.each([
        ["", []],
        ["com1 com2", ["com1", "com2"]],
    ])(
        'should add comments="%s" if args.comments is %s',
        (comments, expectation) => {
            // Arrange
            const args: any = {
                comments,
            };

            // Act
            const result = optionsFromArgs(args);

            // Assert
            expect(result.comments).toEqual(expectation);
        },
    );

    it("should not add dryRun if args.dryRun is not provided", () => {
        // Arrange
        const args: any = {
            dryRun: null,
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.dryRun).not.toBeDefined();
    });

    it("should add dryRun if args.dryRun is provided", () => {
        // Arrange
        const args: any = {
            dryRun: true,
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.dryRun).toBe(true);
    });

    it("should not add rootMarker if args.rootMarker is not provided", () => {
        // Arrange
        const args: any = {
            rootMarker: null,
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.rootMarker).not.toBeDefined();
    });

    it("should add rootMarker if args.rootMarker is provided", () => {
        // Arrange
        const args: any = {
            rootMarker: "ROOT_MARKER",
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.rootMarker).toBe("ROOT_MARKER");
    });

    it("should not add allowEmptyTags if args.allowEmptyTags is not provided", () => {
        // Arrange
        const args: any = {
            allowEmptyTags: null,
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.allowEmptyTags).not.toBeDefined();
    });

    it("should add allowEmptyTags if args.allowEmptyTags is provided", () => {
        // Arrange
        const args: any = {
            allowEmptyTags: false,
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.allowEmptyTags).toBe(false);
    });

    it.each`
        outputCache
        ${""}
        ${"CACHE_PATH"}
    `(
        "should set cacheMode as write if args.outputCache is $outputCache",
        ({outputCache}) => {
            // Arrange
            const args: any = {
                outputCache,
            };

            // Act
            const result = optionsFromArgs(args);

            // Assert
            expect(result.cacheMode).toBe("write");
        },
    );

    it.each`
        fromCache
        ${""}
        ${"CACHE_PATH"}
    `(
        "should set cacheMode as read if args.fromCache is $fromCache",
        ({fromCache}) => {
            // Arrange
            const args: any = {
                fromCache,
            };

            // Act
            const result = optionsFromArgs(args);

            // Assert
            expect(result.cacheMode).toBe("read");
        },
    );

    it("should set cachePath to args.outputCache if args.outputCache is defined and not falsy", () => {
        // Arrange
        const args: any = {
            outputCache: "CACHE_PATH",
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.cachePath).toBe("CACHE_PATH");
    });

    it("should set cachePath to args.fromCache if args.fromCache is defined and not falsy", () => {
        // Arrange
        const args: any = {
            fromCache: "CACHE_PATH",
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.cachePath).toBe("CACHE_PATH");
    });

    it("should not set cachePath if args.outputCache is defined but falsy", () => {
        // Arrange
        const args: any = {
            outputCache: "",
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.cachePath).not.toBeDefined();
    });

    it("should not set cachePath if args.fromCache is defined but falsy", () => {
        // Arrange
        const args: any = {
            fromCache: "",
        };

        // Act
        const result = optionsFromArgs(args);

        // Assert
        expect(result.cachePath).not.toBeDefined();
    });
});
