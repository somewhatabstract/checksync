#!/usr/bin/env node
const path = require("path");
require("@babel/register")({extensions: [".ts"], cwd: path.dirname(__dirname)});
require("../src/main.ts").runCli(__filename);
