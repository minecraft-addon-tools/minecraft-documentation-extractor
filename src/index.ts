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
import extractData from "./extractData";

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
    export interface Parameter {
        name: string;
        type: string;
        description: string;
    }

    export async function fromFile(filename: string) {
        const html = await fs.promises.readFile(filename, "utf8");
        return fromCheerio(cheerio.load(html, { normalizeWhitespace: true }));
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
                parameters: properties.parameters!.map(row => ({
                    name: row[0],
                    type: row[1],
                    description: row[3]
                }))
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
                event.parameters = properties.parameters.map(row => ({
                    name: row[0],
                    type: row[1],
                    description: row[3]
                }));
            result.push(event);
        }
    }
}

