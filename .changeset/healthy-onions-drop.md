---
"checksync": major
---

This fixes an issue where default argument values would override explicit configuration. This was unintentional; only explicitly provided argument values should override configuration. Since some folks may be relying on this broken behaviour, this is a major update. As part of this fix, argument parsing is now handled by yargs instead of minimist
