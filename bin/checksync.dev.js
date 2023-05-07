#!/usr/bin/env node
require("@babel/register")({extensions: [".ts"]});
require("../src/main.ts").runCli(__filename);
