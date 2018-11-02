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

export class Properties {
    name: string = "";
    description: string = "";
    parameters?: HTMLTableElement;
}
export default function extractData(document: Document, id: string | string[], callback: (properties: Properties) => void) {

    if (Array.isArray(id)) {
        for (const x of id) {
            extractData(document, x, callback);
        }
        return;
    }

    const n = document.getElementById(id)!.parentElement;
    if (!n) throw `'${id}' not found`;
    let node: Element = n;

    function next() {
        if (!node.nextElementSibling) throw "end of file";
        node = node.nextElementSibling;
        return node;
    }
    function isHeading(text: string) {
        return node.tagName === "H3" && node.textContent === text;
    }

    next();

    while (true) {
        while (node.tagName !== "H1" && node.tagName !== "H2" || !node.hasChildNodes()) next();
        if (node.tagName === "H1") break;

        const properties = new Properties();

        properties.name = node.textContent!;

        properties.description = node.nextSibling!.textContent!.trim(); // text node
        next(); // <br>
        next();
        if (isHeading("Parameters")) { // <h4>Parameters</h4>
            properties.parameters = next() as HTMLTableElement; // <table>...</table>
            next();
        }

        callback(properties);
    }
}
