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

import * as $ from "cheerio";

export function* extractData(element: Cheerio, topLevelHeadings?: Set<string>) {

    let node = element.parent();
    next();
    while (!isHeading()) next();
    const targetHeadingLevel = getHeadingLevel();

    function isHeading() {
        return node.is(":header");
    }
    function getHeadingLevel() {
        if (isHeading()) return Number.parseInt(node.get(0).tagName[1]);
        else throw "not a heading";
    }
    function isHeadingText(text: string) {
        return isHeading() && getHeadingLevel() > targetHeadingLevel && node.text() === text;
    }
    function next() {
        node = node.next();
    }

    while (true) {
        while (node.length !== 0 && (!isHeading() || getHeadingLevel() > targetHeadingLevel || node.is(":empty"))) next();
        if (node.length === 0 || getHeadingLevel() < targetHeadingLevel || (topLevelHeadings && topLevelHeadings.has(node.text()))) break;

        const properties = new Properties();

        properties.name = node.text();
        next();

        properties.description = node.get(0).previousSibling.nodeValue.trim(); // text node <br>
        next();
        while (node.is("br")) {
            properties.description += "\n" + node.get(0).previousSibling.nodeValue.trim();
            next();
        }

        if (isHeadingText("Parameters")) { // <h4>Parameters</h4>
            next();
            properties.parameters = parseTable(node); // <table>...</table>
            next();
        }

        yield properties;
    }
}

function parseTable(table: Cheerio): Table {
    const rows = table.children("tbody").children("tr").slice(1).get();
    return rows.map(r => {
        const row = $(r);
        const nestedTable = row.find("table");
        nestedTable.remove();
        const tableRow: TableRow = {
            cells: row.children("td").get().map(c => $(c).text().trim())
        };
        if (nestedTable.length === 1)
            tableRow.nestedTable = parseTable(nestedTable);
        return tableRow;
    });
}

export class Properties {
    name: string = "";
    description: string = "";
    parameters?: Table;
}

export type Table = TableRow[];

export interface TableRow {
    cells: string[];
    nestedTable?: Table;
}