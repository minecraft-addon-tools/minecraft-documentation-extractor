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

import { MinecraftScriptDocumentation } from '.';
import * as fs from 'fs';

const args = process.argv.slice(2);

if (args.length === 0 || args.length > 2) {
    console.log("Usage: minecraft-documentation-extractor <input_file> [output_file]");
} else {
    (async () => {
        const documentation = await MinecraftScriptDocumentation.fromFile(args[0]);
        const output = JSON.stringify(documentation, undefined, 2);
        if (args.length === 2) {
            await fs.promises.writeFile(args[1], output, "utf8");
        } else {
            console.log(output);
        }
    })();
}