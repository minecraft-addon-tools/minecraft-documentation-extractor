import * as untypedOverrideList from "./type-overrides.json";
import { cloneDeep } from "lodash";
import { isArray, isObject } from "util";
import cleanDeep = require("clean-deep");
import {
    Version,
    MinecraftScriptDocumentation,
    Component,
    Event,
    Type,
    UnionType,
    ObjectType,
    isObjectType,
    ArrayType,
    Field,
    isArrayType
} from "./index.js";

const verbose = false;

interface DebugTracking {
    _processed?: boolean;
    _issues?: string[];
}

interface ObjectFieldOverride extends DebugTracking {
    _comment?: string;
    //default is "change"
    _operation?: string; //"add" | "remove" | "change" | "discuss";

    name?: string;
    description?: string;
    isOptional?: boolean;
    isArray?: boolean; //default false
    defaultValue?: any;
    type?: OverrideTypeDefinition;
}

type OverrideTypeDefinition = ObjectTypeOverride | string | string[];

interface ObjectTypeOverride {
    [key: string]: ObjectFieldOverride;
}

interface RootElementOverride extends DebugTracking {
    _comment?: string;
    //default is "change"
    _operation?: string; //"add" | "remove" | "change" | "discuss";

    name?: string;
    description?: string;
    isArray?: boolean;
    type?: OverrideTypeDefinition;
}

interface RootElementOverrideSet {
    [key: string]: RootElementOverride;
}

interface IScriptingDocumentationOverrides {
    version: Version;
    overrides: {
        component?: RootElementOverrideSet;
        event: {
            client: {
                listening?: RootElementOverrideSet,
                triggerable?: RootElementOverrideSet
            };
            server: {
                listening?: RootElementOverrideSet,
                triggerable?: RootElementOverrideSet
            };
        };
    };
}

const overrideList: IScriptingDocumentationOverrides = cloneDeep(untypedOverrideList);
const overridesVersion = overrideList.version;

export function applyOverridesToDocumentation(documentation: MinecraftScriptDocumentation) {
    console.log("Applying overrides...");
    checkDocumentationVersion(documentation.version);
    documentation.components = overrideTopLevelElement(documentation.components, overrideList.overrides.component);
    documentation.events.client.listening = overrideTopLevelElement(documentation.events.client.listening, overrideList.overrides.event.client.listening);
    documentation.events.client.triggerable = overrideTopLevelElement(documentation.events.client.triggerable, overrideList.overrides.event.client.triggerable);
    documentation.events.server.listening = overrideTopLevelElement(documentation.events.server.listening, overrideList.overrides.event.server.listening);
    documentation.events.server.triggerable = overrideTopLevelElement(documentation.events.server.triggerable, overrideList.overrides.event.server.triggerable);
    verifyAllOverridesConsumed();
}

function checkDocumentationVersion(documentationVersion: Version | null) {
    if (documentationVersion == null) {
        console.error("The version number was unable to be extracted from the documentation");
        throw new Error("Documentation version error");
    }

    if (documentationVersion.major !== overridesVersion.major ||
        documentationVersion.minor !== overridesVersion.minor ||
        documentationVersion.revision !== overridesVersion.revision ||
        documentationVersion.build !== overridesVersion.build) {
        console.error("-----------------------------------------------------------------------------");
        console.error("             The documentation version has been bumped!                      ");
        console.error("You will need to review the overrides to make sure they are still appropriate");
        console.error("          and then bump the version in type-overrides.json                   ");
        console.error("-----------------------------------------------------------------------------");
        console.info(`expected: ${JSON.stringify(overrideList.version)}`);
        console.info(`actual  : ${JSON.stringify(documentationVersion)}`);
    }
}

function convertToObjectType(type?: Type): ObjectType {
    if (isObjectType(type)) {
        return <ObjectType>type;
    }
    return <ObjectType>{
        kind: "object",
        fields: []
    }
}

function isObjectTypeOverride(overrides?: OverrideTypeDefinition): overrides is ObjectTypeOverride {
    return isObject(overrides) && !isArray(overrides);
}

export function overrideTopLevelElement(originalElements: Component[] | Event[], overrides?: RootElementOverrideSet): Component[] | Event[] {
    if (!overrides) return originalElements;
    let elements = cloneDeep(originalElements);

    for (const [name, override] of Object.entries(overrides)) {
        verbose && console.log(`element: ${name}`);
        override._processed = false;
        override._issues = [];

        if (override._operation === "discuss") {
            override._issues.push("Element was marked for discussion. No changes are applied, no children are processed");

        } else if (override._operation === "add") {
            override._processed = true;
            if (!override.description) {
                override._issues.push(`Description must be provided for element being added: ${name}`);
                override._processed = false;
            }

            if (elements.some(c => c.name === name)) {
                override._issues.push(`An element with the name "${name}" already exists`);
                override._processed = false;
            }

            if (override._processed) {
                // Right now, Component and Event are identical, so I can get away with this.
                const newComponent: Component | Event = {
                    name: name,
                    description: <string>override.description,
                    type: overrideTypeDefinition("any", override.type)
                };

                if (override.isArray) {
                    newComponent.type = <ArrayType>{
                        kind: "array",
                        type: newComponent.type
                    }
                }

                elements.push(newComponent);
            }

        } else if (override._operation === "remove") {
            if (!elements.find(c => c.name === name)) {
                override._issues.push(`Attempted to remove an element with the name "${override.name}" but it did not exist`);

            } else {
                elements = elements.filter(c => c.name !== name);
                override._processed = true;
            }

        } else if (override._operation === "change" || !override._operation) {
            const targetElement = elements.find(c => c.name === name);
            if (!targetElement) {
                override._issues.push(`Could not find an element with the name ${name}`);

            } else {
                if (override.name !== undefined) {
                    targetElement.name = override.name;
                }

                if (override.description !== undefined) {
                    targetElement.description = override.description;
                }

                if (override.type !== undefined) {
                    let convertToArray = override.isArray;
                    let originalArrayType = undefined;

                    if (isArrayType(targetElement.type)) {
                        originalArrayType = targetElement.type.originalType;
                        targetElement.type = targetElement.type.type;
                        convertToArray = convertToArray === undefined ? true : convertToArray
                    }

                    targetElement.type = overrideTypeDefinition(targetElement.type || "any", override.type);

                    if (convertToArray) {
                        targetElement.type = <ArrayType>{
                            kind: "array",
                            originalType: originalArrayType,
                            type: targetElement.type
                        }
                    }
                }
                override._processed = true;
            }

        } else {
            override._issues.push(`Unexpected operation ${override._operation} for element ${override.name}`);
            const targetElement = elements.find(c => c.name === name);

            if (override.type && targetElement) {
                targetElement.type = !targetElement.type
                    ? undefined
                    : overrideTypeDefinition(targetElement.type, override.type);
            }
        }
    }

    return elements;
}

export function overrideTypeDefinition(originalType: Type, overrideDefinition?: OverrideTypeDefinition, indent: number = 1): Type {
    if (!overrideDefinition) return cloneDeep(originalType);
    originalType = originalType ? cloneDeep(originalType) : "any";

    if (!isObjectTypeOverride(overrideDefinition)) {
        if (isArray(overrideDefinition)) {
            return <UnionType>{
                kind: "union",
                unionTypes: overrideDefinition
            }

        } else {
            return overrideDefinition;
        }
    }

    let type = convertToObjectType(originalType);

    for (const [name, override] of Object.entries(overrideDefinition)) {
        override._processed = false;
        override._issues = []

        if (override._operation === "discuss") {
            override._issues.push("Element was marked for discussion. No changes are applied, no children are processed");

        } else if (override._operation === "add") {
            let isValid = true;

            if (!override.description) {
                override._issues.push(`Description must be provided for parameter being added: ${name}`);
                isValid = false;
            }

            if (type.fields.some(c => c.name === override.name)) {
                override._issues.push(`A parameter with the name "${override.name}" already exists`);
                isValid = false;
            }

            if (isValid) {
                verbose && console.log(`${"  ".repeat(indent)}> + ${name}`);
                const newParameter: Field = {
                    name: name,
                    description: <string>override.description,
                    isOptional: override.isOptional,
                    defaultValue: override.defaultValue,
                    type: overrideTypeDefinition("any", override.type, indent + 1)
                };

                if (override.isArray) {
                    newParameter.type = <ArrayType>{
                        kind: "array",
                        type: newParameter.type
                    }
                }

                type.fields.push(newParameter);

            } else {
                verbose && console.log(`!!${"  ".repeat(indent - 1)}> ${name}`);
            }

            override._processed = isValid;

        } else if (override._operation === "remove") {
            if (!type.fields.find(c => c.name === name)) {
                verbose && console.log(`!!${"  ".repeat(indent - 1)}> ${name}`);
                override._issues.push(`Attempted to remove a component with the name "${name}" but it did not exist`);

            } else {
                type.fields = type.fields.filter(c => c.name !== name);
                verbose && console.log(`${"  ".repeat(indent)}> - ${name}`);
                override._processed = true;
            }

        } else if (override._operation === "change" || !override._operation) {
            verbose && console.log(`${"  ".repeat(indent)}> * ${name}`);

            const targetField = type.fields.find(p => p.name === name);
            if (!targetField) {
                override._issues.push(`Attempted to modify a parameter with the name "${name}" but it did not exist`);

            } else {
                if (override.name !== undefined) {
                    targetField.name = <string>override.name;
                }

                if (override.description !== undefined) {
                    targetField.description = <string>override.description;
                }

                if (override.isOptional !== undefined) {
                    targetField.isOptional = override.isOptional;
                }

                if (override.defaultValue !== undefined) {
                    targetField.defaultValue = override.defaultValue;
                }

                let convertToArray = override.isArray;
                let originalArrayType = undefined;

                if (isArrayType(targetField.type)) {
                    originalArrayType = targetField.type.originalType;
                    targetField.type = targetField.type.type;
                    convertToArray = convertToArray === undefined ? true : convertToArray
                }

                targetField.type = overrideTypeDefinition(targetField.type, override.type, indent + 1);
                if (convertToArray) {
                    targetField.type = <ArrayType>{
                        kind: "array",
                        originalType: originalArrayType,
                        type: targetField.type
                    }
                }

                override._processed = true;
            }

        } else {
            override._issues.push(`Unexpected operation ${override._operation} for component ${name}`);

            const targetField = type.fields.find(c => c.name === name);
            if (override.type && targetField) {
                targetField.type = overrideTypeDefinition(targetField.type, override.type);
            }
        }
    }

    return type;
}

export function verifyAllOverridesConsumed() {
    const checkingOverrides = cloneDeep(overrideList);
    const allElementsRemoved = [
        checkingOverrides.overrides.component,
        checkingOverrides.overrides.event.client.listening,
        checkingOverrides.overrides.event.client.triggerable,
        checkingOverrides.overrides.event.server.listening,
        checkingOverrides.overrides.event.server.triggerable,
    ].reduce((p, c) => removeProcessedComponents(c) && p, true);

    delete checkingOverrides.version;
    const cleanedOutput = cleanDeep(checkingOverrides, { emptyString: false, nullValues: false });

    if (!allElementsRemoved) {
        console.warn("There are issues in the overrides:");
        console.log(JSON.stringify(cleanedOutput, undefined, 2));
    }
}

function removeProcessedComponents(items?: RootElementOverrideSet): boolean {
    if (!items) return true;

    let allItemsTouched = true;
    for (const [name, item] of Object.entries(items)) {
        let allChildItemsTouched = true;
        const typeDefinition = item.type;
        if (!!typeDefinition && isObjectTypeOverride(typeDefinition)) {
            allChildItemsTouched = allChildItemsTouched && removeProcessedComponents(typeDefinition);
        }

        allItemsTouched = allItemsTouched && !!item._processed && allChildItemsTouched;

        if (item._processed) {
            if (allChildItemsTouched) {
                delete items[name];
            }
            delete item._processed;
        }
    }

    return allItemsTouched;
}
