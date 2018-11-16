#!/usr/bin/env node

/*
 * Copyright (C) 2018 Filip Hejsek
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

import { MinecraftScriptDocumentation, MinecraftAddonDocumentation } from '.';
import * as fs from 'fs';

const TYPES: { [name: string]: { fromFile(filename: string): object } } = {
    "script": MinecraftScriptDocumentation, "addon": MinecraftAddonDocumentation
};

const args = process.argv.slice(2);

if (args.length < 1 || args.length > 3 || !TYPES[args[0]]) {
    console.log("Usage: minecraft-documentation-extractor (scripting | addons) <input_file> [output_file]");
} else {
    (async () => {
        const type = TYPES[args[0]];
        const documentation = await type.fromFile(args[1]);
        const output = JSON.stringify(documentation, undefined, 2);
        if (args.length === 2) {
            await fs.promises.writeFile(args[2], output, "utf8");
        } else {
            console.log(output);
        }
    })();
}