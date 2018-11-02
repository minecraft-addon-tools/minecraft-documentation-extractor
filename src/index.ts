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

import { JSDOM } from "jsdom";
import extractData from "./extractData";

export interface MinecraftScriptDocumentation {
    components: MinecraftScriptDocumentation.Component[];
}

export namespace MinecraftScriptDocumentation {
    export interface Component {
        name: string;
        description: string;
        parameters: Parameter[];
    }
    export interface Parameter {
        name: string;
        type: string;
        description: string;
    }

    export function fromDocument(document: Document): MinecraftScriptDocumentation {
        const components = extractComponents(document);
        return { components };
    }

    export async function fromFile(filename: string) {
        const jsdom = await JSDOM.fromFile(filename);
        return fromDocument(jsdom.window.document);
    }

    function extractComponents(document: Document): Component[] {
        const result: Component[] = [];
        extractData(document, "Server Components", (properties) => {
            result.push({
                name: properties.name,
                description: properties.description,
                parameters: Array.from(properties.parameters!.rows).slice(1).map(row => {
                    return {
                        name: row.cells[0].textContent!,
                        type: row.cells[1].textContent!,
                        description: row.cells[3].textContent!
                    };
                })
            });

        });
        return result;
    };
}

