#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
require("@babel/register")({extensions: [".ts"], cwd: path.dirname(__dirname)});
require("../src/main.ts").runCli(__filename);
