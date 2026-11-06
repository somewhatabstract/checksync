---
"checksync": patch
---

Fix three problems loading a configuration file:

- A configuration that fails schema validation now says what is wrong instead of exiting with no message.
- A configuration whose top level isn't a JSON object, such as `[]`, is now rejected instead of being treated as empty.
- A relative `--config` path to a file in another folder now works; it was being opened again after changing to that folder.
