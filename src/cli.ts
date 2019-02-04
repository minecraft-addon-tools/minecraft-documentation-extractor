#!/usr/bin/env node

/*
 * Copyright (C) 2018, 2019 Filip Hejsek
 *
 * This file is part of minecraft-documentation-extractor.
 *
 * minecraft-documentation-extractor is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * minecraft-documentation-extractor is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with minecraft-documentation-extractor.  If not, see <https://www.gnu.org/licenses/>.
 */

import { MinecraftScriptDocumentation, MinecraftAddonDocumentation, getCheerioOptions } from '.';
import * as cheerio from "cheerio";
import * as fs from 'fs';

const args = process.argv.slice(2);
let sourceFile: string | null = null;
let outputFile: string | null = null;
let sort = false;
let fix = false;
let type: typeof MinecraftScriptDocumentation | typeof MinecraftAddonDocumentation | null = null;
for (const arg of args) {
    if (arg.startsWith("--")) {
        switch (arg) {
            case "--sort":
                sort = true; break;
            case "--fix":
                fix = true; break;
            case "--scripting":
                if (type) error("Multiple types specified");
                type = MinecraftScriptDocumentation; break;
            case "--addons":
                if (type) error("Multiple types specified");
                type = MinecraftAddonDocumentation; break;
            default: error("Unknown option: " + arg);
        }
    } else {
        if (!sourceFile)
            sourceFile = arg;
        else if (!outputFile)
            outputFile = arg;
        else error("Too many arguments");
    }
}

if (args.length === 0) {
    usage();
} else if (!sourceFile) {
    error("No source file");
} else {
    (async () => {
        const html = await fs.promises.readFile(sourceFile, "utf8");
        const $ = cheerio.load(html, getCheerioOptions());
        if (!type) {
            const heading = $("h1:first-of-type").first().text();
            if (heading.includes("SCRIPTING DOCUMENTATION"))
                type = MinecraftScriptDocumentation;
            else if (heading.includes("ADDONS DOCUMENTATION"))
                type = MinecraftAddonDocumentation;
            else {
                console.log("Error: Couldn't determine documentation type");
                return process.exit(2);
            }
        }
        const documentation = type.fromCheerio($, { sort, fix });
        const output = JSON.stringify(documentation, undefined, 2);
        if (outputFile) {
            await fs.promises.writeFile(outputFile, output, "utf8");
        } else {
            console.log(output);
        }
    })();
}

function usage() {
    console.log("Usage: minecraft-documentation-extractor [--scripting | --addons] [--sort] [--fix] <input_file> [<output_file>]");
}

function error(message: string): never {
    console.log("Error: " + message);
    usage();
    return process.exit(1);
}
