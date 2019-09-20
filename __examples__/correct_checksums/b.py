# Test file in Python style

# sync-start:correct 770446101 __examples__/correct_checksums/a.js
code = 1
# sync-end:correct

# sync-start:correct2 322927876 __examples__/correct_checksums/a.js
genwebpack/khan-apollo/fragment-types.js genfiles/graphql_schema.json: $(shell find */graphql */*/graphql -name '*.py' -a ! -name '*_test.py')
	$(MAKE) update_secrets
	build/compile_graphql_schemas.py
# sync-end:correct2