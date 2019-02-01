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
