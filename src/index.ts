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

import * as cheerio from "cheerio";
import * as fs from "fs";
import { extractData, Table } from "./extractData";

export interface Parameter {
    name: string;
    type: string;
    description: string;
    nestedParameters?: Parameter[];
}

export interface MinecraftScriptDocumentation {
    components: MinecraftScriptDocumentation.Component[];
    events: {
        client: { listening: MinecraftScriptDocumentation.Event[], triggerable: MinecraftScriptDocumentation.Event[] },
        server: { listening: MinecraftScriptDocumentation.Event[], triggerable: MinecraftScriptDocumentation.Event[] }
    };
}

export namespace MinecraftScriptDocumentation {
    export interface Component {
        name: string;
        description: string;
        parameters: Parameter[];
    }
    export interface Event {
        name: string;
        description: string;
        parameters?: Parameter[];
    }

    export async function fromFile(filename: string) {
        return fromCheerio(await cheerioFromFile(filename));
    }

    export function fromCheerio($: CheerioStatic): MinecraftScriptDocumentation {
        const result: MinecraftScriptDocumentation = {
            components: [],
            events: {
                client: { listening: [], triggerable: [] },
                server: { listening: [], triggerable: [] }
            }
        };
        for (const properties of extractData($("#Server\\ Components"))) {
            result.components.push({
                name: properties.name,
                description: properties.description,
                parameters: extractParameters(properties.parameters!)
            });
        }
        extractEvents($(":has(#Client\\ Events) ~ * > #Listening\\ Events").first(), result.events.client.listening);
        extractEvents($(":has(#Client\\ Events) ~ * > #Trigger-able\\ Events").first(), result.events.client.triggerable);
        extractEvents($(":has(#Server\\ Events) ~ * > #Listening\\ Events").first(), result.events.server.listening);
        extractEvents($(":has(#Server\\ Events) ~ * > #Trigger-able\\ Events").first(), result.events.server.triggerable);
        return result;
    }

    function extractEvents(element: Cheerio, result: Event[]) {
        for (const properties of extractData(element)) {
            const event: Event = {
                name: properties.name,
                description: properties.description,
            };
            if (properties.parameters)
                event.parameters = extractParameters(properties.parameters);
            result.push(event);
        }
    }
}

export interface MinecraftAddonDocumentation {
    components: MinecraftAddonDocumentation.Component[];
}

export namespace MinecraftAddonDocumentation {
    export interface Component {
        name: string;
        description: string;
        parameters?: Parameter[];
    }

    export async function fromFile(filename: string) {
        return fromCheerio(await cheerioFromFile(filename));
    }

    export function fromCheerio($: CheerioStatic): MinecraftAddonDocumentation {
        const result: MinecraftAddonDocumentation = {
            components: []
        };
        const topLevelHeadings = new Set($(":has(#Index) + table th").get().map(x => $(x).text()));
        for (const properties of extractData($("#Components"), topLevelHeadings)) {
            const component: Component = {
                name: properties.name,
                description: properties.description
            };
            if (properties.parameters)
                component.parameters = extractParameters(properties.parameters);
            result.components.push(component);
        }
        return result;
    }
}

async function cheerioFromFile(filename: string) {
    const html = await fs.promises.readFile(filename, "utf8");
    return cheerio.load(html, { normalizeWhitespace: true });
}

function extractParameters(table: Table): Parameter[] {
    return table.map(row => {
        const parameter: Parameter = {
            name: row.columns[0],
            type: row.columns[1],
            description: row.columns[row.columns.length - 1] // default value may be missing
        }
        if (row.nestedTable)
            parameter.nestedParameters = extractParameters(row.nestedTable);
        return parameter;
    });
}
