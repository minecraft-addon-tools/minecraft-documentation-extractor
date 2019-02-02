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
import { extractData, Table, Properties } from "./extractData";
import { sortComponents, sortFilters, sortEvents } from "./sort";

export interface Version {
    major: number;
    minor: number;
    revision: number;
    build: number;
}

export interface Component {
    name: string;
    description: string;
    parameters?: Parameter[];
}
export interface Filter {
    name: string;
    type: string;
    description: string;
    options?: string[];
}
export interface Event {
    name: string;
    description: string;
    parameters?: Parameter[];
}

export interface Parameter {
    name: string;
    type: string;
    defaultValue?: string;
    description: string;
    nestedParameters?: Parameter[];
}

export interface Options {
    sort?: boolean;
}

export interface MinecraftScriptDocumentation {
    version: Version;
    components: Component[];
    events: {
        client: { listening: Event[], triggerable: Event[] },
        server: { listening: Event[], triggerable: Event[] }
    };
}

export namespace MinecraftScriptDocumentation {
    export async function fromFile(filename: string, options?: Options) {
        return fromCheerio(await cheerioFromFile(filename), options);
    }

    export function fromCheerio($: CheerioStatic, options?: Options): MinecraftScriptDocumentation {
        const result: MinecraftScriptDocumentation = {
            version: getVersion($),
            components: [],
            events: {
                client: { listening: [], triggerable: [] },
                server: { listening: [], triggerable: [] }
            }
        };

        for (const properties of extractData($("#Server\\ Components"))) {
            result.components.push(extractComponent(properties));
        }
        extractEvents($(":has(#Client\\ Events) ~ * > #Listening\\ Events").first(), result.events.client.listening);
        extractEvents($(":has(#Client\\ Events) ~ * > #Trigger-able\\ Events").first(), result.events.client.triggerable);
        extractEvents($(":has(#Server\\ Events) ~ * > #Listening\\ Events").first(), result.events.server.listening);
        extractEvents($(":has(#Server\\ Events) ~ * > #Trigger-able\\ Events").first(), result.events.server.triggerable);

        if (options && options.sort) {
            sortComponents(result.components);
            sortEvents(result.events.client.listening);
            sortEvents(result.events.client.triggerable);
            sortEvents(result.events.server.listening);
            sortEvents(result.events.server.triggerable);
        }

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
    version: Version;
    properties: Component[];
    components: Component[];
    aiGoals: Component[];
    filters: Filter[];
}

export namespace MinecraftAddonDocumentation {
    export async function fromFile(filename: string, options?: Options) {
        return fromCheerio(await cheerioFromFile(filename), options);
    }

    export function fromCheerio($: CheerioStatic, options?: Options): MinecraftAddonDocumentation {
        const result: MinecraftAddonDocumentation = {
            version: getVersion($),
            properties: [],
            components: [],
            aiGoals: [],
            filters: []
        };

        const topLevelHeadings = new Set($(":has(#Index) + table th").get().map(x => $(x).text()));
        for (const properties of extractData($("h1 #Properties"), topLevelHeadings)) {
            result.properties.push(extractComponent(properties));
        }
        for (const properties of extractData($("h1 #Components"), topLevelHeadings)) {
            result.components.push(extractComponent(properties));
        }
        for (const properties of extractData($("#AI\\ Goals"), topLevelHeadings)) {
            result.aiGoals.push(extractComponent(properties));
        }
        for (const properties of extractData($("#Filters"), topLevelHeadings)) {
            if (!properties.parameters) throw "filter doesn't have parameters";
            const row = properties.parameters[properties.parameters.length - 1];
            if (row.cells[0] !== "value") throw (row.cells[0] + " !== value");
            const options = row.nestedTable;
            const filter: Filter = {
                name: properties.name,
                type: row.cells[1],
                description: properties.description
            };
            if (options) filter.options = options.map(x => x.cells[0]);
            result.filters.push(filter);
        }

        if (options && options.sort) {
            sortComponents(result.properties);
            sortComponents(result.components);
            sortComponents(result.aiGoals);
            sortFilters(result.filters);
        }

        return result;
    }
}

export function getCheerioOptions(): CheerioOptionsInterface {
    return { normalizeWhitespace: true };
}
async function cheerioFromFile(filename: string) {
    const html = await fs.promises.readFile(filename, "utf8");
    return cheerio.load(html, getCheerioOptions());
}

function extractParameters(table: Table): Parameter[] {
    return table.map(row => {
        const parameter: Parameter = {
            name: row.cells[0],
            type: row.cells[1],
            defaultValue: row.cells.length > 3 && row.cells[2] ? row.cells[2] : undefined,
            description: row.cells[row.cells.length - 1] // default value may be missing
        }
        if (row.nestedTable)
            parameter.nestedParameters = extractParameters(row.nestedTable);
        return parameter;
    });
}

function extractComponent(properties: Properties): Component {
    const component: Component = {
        name: properties.name,
        description: properties.description
    };
    if (properties.parameters)
        component.parameters = extractParameters(properties.parameters);
    return component;
}

function getVersion($: CheerioStatic): Version {
    const heading = $("h1:first-of-type").first().text();
    const [major, minor, revision, build] =
        /(\d+)\.(\d+)\.(\d+)\.(\d+)/.exec(heading)!.slice(1).map(Number);
    return { major, minor, revision, build };
}
