#!/usr/bin/env node
require("@babel/register");
require("../src/cli.js").run(__filename);
