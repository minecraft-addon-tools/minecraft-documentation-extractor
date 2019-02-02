/*
 * Copyright (C) 2019 Filip Hejsek
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

import { Parameter, Component, Filter, Event } from "./index";

function sortByName(array: { name: string }[]) {
    array.sort((a, b) => a.name === b.name ? 0 : a.name < b.name ? -1 : 1);
}

function sortParameters(parameters: Parameter[]) {
    sortByName(parameters);
    parameters.forEach(p => {
        if (p.nestedParameters)
            sortParameters(p.nestedParameters);
    });
}

export function sortComponents(components: Component[]) {
    sortByName(components);
    components.forEach(c => {
        if (c.parameters)
            sortParameters(c.parameters);
    });
}

export function sortFilters(filters: Filter[]) {
    sortByName(filters);
    filters.forEach(f => {
        if (f.options)
            f.options.sort();
    });
}

export function sortEvents(events: Event[]) {
    sortByName(events);
    events.forEach(e => {
        if (e.parameters)
            sortParameters(e.parameters);
    });
}
