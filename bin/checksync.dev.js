#!/usr/bin/env node
require("@babel/register");
require("../src/main.js").runCli(__filename);
