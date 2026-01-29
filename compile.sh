#!/bin/sh
#
# Simple deno compile script; helps to verify Typescript compilation errors
#
deno compile --output bin/mod ./src/mod.ts
deno compile --output bin/express ./src/express/mod.ts
deno compile --output bin/oak ./src/oak/mod.ts