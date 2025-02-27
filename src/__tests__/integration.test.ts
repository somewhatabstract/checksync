import {Scenario, getExamples, readLog} from "../integration-test-support";

/**
 * IMPORTANT: Before running these tests, make sure to have run the
 * bin/gen-integration-test-logs tool that generates the log files.
 *
 * Generally best to just run `pnpm run tests:integration` to do all this.
 */
describe("Integration Tests (see __examples__ folder)", () => {
    // For each example that we want to run for the current platform.
    describe.each(getExamples())("Example %s", (example) => {
        // For each scenario we want to cover
        it.each([undefined, ...Object.values(Scenario)])(
            `should report example ${example} to match snapshot for scenario %s`,
            async (scenario) => {
                const log = await readLog(example, scenario);
                expect(log).toMatchSnapshot();
            },
        );
    });
});
