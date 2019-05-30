/*
 * Copyright (C) 2018 Filip Hejsek, Steven Blom
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
    isArrayType,
    Method,
    System,
    ReturnedType
} from "./index";

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

interface MethodReturnTypeOverride extends DebugTracking {
    _comment?: string;
    //default is "change"
    _operation?: string; //"add" | "remove" | "change" | "discuss";

    description?: string;
    isArray?: boolean; //default false
    value?: string;
    type?: ObjectFieldOverride;// | string;
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

interface MethodElementOverrideSelector extends DebugTracking {
    _comment?: string;
    findByParameters: string[];
    override: MethodElementOverride;
}

interface MethodElementOverride extends DebugTracking {
    _comment?: string;
    //default is "change"
    _operation?: string; //"add" | "remove" | "change" | "discuss";

    name?: string;
    description?: string;
    category?: string;
    system?: string; // "Client" | "Server" | "Both";
    parameters?: ObjectTypeOverride;
    returnIsArray?: boolean;
    returnTypes?: OverrideReturnTypeDefinitionSelector[];
}

interface OverrideReturnTypeDefinitionSelector extends DebugTracking {
    findByType: string,
    override: MethodReturnTypeOverride
}

interface RootElementOverrideSet {
    [key: string]: RootElementOverride;
}

interface MethodElementOverrideSet {
    [key: string]: MethodElementOverride | MethodElementOverrideSelector | (MethodElementOverride | MethodElementOverrideSelector)[];
}

export interface IScriptingDocumentationOverrides {
    version: Version;
    overrides: {
        systemMethods?: MethodElementOverrideSet;
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

export function applyDefaultOverrides(documentation: MinecraftScriptDocumentation) {
    console.log("Applying overrides...");
    applyOverrides(documentation, overrideList);
}

export function applyOverrides(documentation: MinecraftScriptDocumentation, overrideDefinitionFile: IScriptingDocumentationOverrides) {
    const clonedOverrideDefinitionFile = cloneDeep(overrideDefinitionFile);
    checkDocumentationVersion(documentation.version, clonedOverrideDefinitionFile.version);
    const overrides = clonedOverrideDefinitionFile.overrides;

    if (overrides.systemMethods) {
        documentation.systemMethods = overrideMethodElement(documentation.systemMethods, overrides.systemMethods);
    }
    if (overrides.component) {
        documentation.components = overrideTopLevelElement(documentation.components, overrides.component);
    }
    if (overrides.event) {
        if (overrides.event.client) {
            if (documentation.events.client.listening) {
                documentation.events.client.listening = overrideTopLevelElement(documentation.events.client.listening, overrides.event.client.listening);
            }
            if (overrides.event.client.triggerable) {
                documentation.events.client.triggerable = overrideTopLevelElement(documentation.events.client.triggerable, overrides.event.client.triggerable);
            }
        }
        if (overrides.event.server) {
            if (overrides.event.server.listening) {
                documentation.events.server.listening = overrideTopLevelElement(documentation.events.server.listening, overrides.event.server.listening);
            }
            if (overrides.event.server.triggerable) {
                documentation.events.server.triggerable = overrideTopLevelElement(documentation.events.server.triggerable, overrides.event.server.triggerable);
            }
        }
    }
    verifyAllOverridesConsumed(clonedOverrideDefinitionFile);
}

function checkDocumentationVersion(documentationVersion: Version | null, overrideDefinitionVersion: Version) {
    if (documentationVersion == null) {
        console.error("The version number was unable to be extracted from the documentation");
        throw new Error("Documentation version error");
    }

    if (documentationVersion.major !== overrideDefinitionVersion.major ||
        documentationVersion.minor !== overrideDefinitionVersion.minor ||
        documentationVersion.revision !== overrideDefinitionVersion.revision ||
        documentationVersion.build !== overrideDefinitionVersion.build) {
        console.error("-----------------------------------------------------------------------------");
        console.error("             The documentation version has been bumped!                      ");
        console.error("You will need to review the overrides to make sure they are still appropriate");
        console.error("          and then bump the version in type-overrides.json                   ");
        console.error("-----------------------------------------------------------------------------");
        console.info(`expected: ${JSON.stringify(overrideDefinitionVersion)}`);
        console.info(`actual  : ${JSON.stringify(overrideList.version)}`);
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

function isSelector(override: MethodElementOverride | MethodElementOverrideSelector): override is MethodElementOverrideSelector {
    return (<MethodElementOverrideSelector>override).findByParameters !== undefined
}

export function overrideMethodElement(originalElements: Method[], overrides?: MethodElementOverrideSet): Method[] {
    if (!overrides) return originalElements;
    let fullElementList = cloneDeep(originalElements);

    for (const [name, tempOverride] of Object.entries(overrides)) {
        verbose && console.log(`element: ${name}`);
        
        const overrideList = isArray(tempOverride) ? tempOverride : [tempOverride];
        for (let override of overrideList) {
            let elements = fullElementList;

            if (isSelector(override)) {
                const overrideSelector = override;
                override = override.override;

                overrideSelector._processed = true;
                overrideSelector._issues = [];
                elements = elements.filter(e => {
                    //If a selector is set, then reduce to exclude any that don't match.
                    if (e.name !== name) return false;
                    for (let i = 0; i < overrideSelector.findByParameters.length; i++) {
                        const parameterName = overrideSelector.findByParameters[i];
                        if (e.parameters.length < i || e.parameters[i].name !== parameterName) {
                            return false;
                        }
                    }
                    return true;
                })
                
                if (elements.length === 0) {
                    overrideSelector._processed = false;
                    overrideSelector._issues.push(`Attempted to select a method with the name "${name}" but it did not exist`);
                    continue;
                }
            }

            override._processed = false;
            override._issues = [];
    
            if (override._operation === "discuss") {
                override._issues.push("Element was marked for discussion. No changes are applied, no children are processed");
    
            } else if (override._operation === "add") {
                throw new Error("Add not implemented for system methods");
    
            } else if (override._operation === "remove") {
                const targetElement = elements.find(c => c.name === name);
                if (targetElement === undefined) {
                    override._issues.push(`Could not find an element with the name ${name}`);

                } else {
                    fullElementList = fullElementList.filter(t => t !== targetElement);
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
    
                    if (override.category !== undefined) {
                        targetElement.category = override.category;
                    }
                    if (override.system !== undefined) {
                        if (override.system !== "Server" && override.system !== "Client" && override.system !== "Both") {
                            override._issues.push(`An invalid system was specified in system method ${name}: ${override.system}`);
                        }
                        targetElement.system = <System>override.system;
                    }
    
                    if (override.parameters !== undefined) {
                        for (const [parameterOverrideName, parameterOverride] of Object.entries(override.parameters)) {
                            parameterOverride._processed = false;
                            parameterOverride._issues = []
                            const targetParameter = targetElement.parameters.find(p => p.name === parameterOverrideName)
                            if (targetParameter === undefined) {
                                parameterOverride._issues.push(`Could not find parameter with name ${parameterOverrideName}`)
                                continue;
                            }

                            if (parameterOverride.name !== undefined) {
                                targetParameter.name = parameterOverride.name;
                            }
                            if (parameterOverride.description !== undefined) {
                                targetParameter.description = parameterOverride.description;
                            }
                            if (parameterOverride.isOptional !== undefined) {
                                targetParameter.isOptional = parameterOverride.isOptional;
                            }
                            if (parameterOverride.defaultValue !== undefined) {
                                targetParameter.defaultValue = parameterOverride.defaultValue;
                            }
                            if (parameterOverride.type !== undefined) {
                                let convertToArray = parameterOverride.isArray;
                                let originalArrayType = undefined;

                                if (isArrayType(targetParameter.type)) {
                                    originalArrayType = targetParameter.type.originalType;
                                    targetParameter.type = targetParameter.type.type;
                                    convertToArray = convertToArray === undefined ? true : convertToArray
                                }

                                targetParameter.type = overrideTypeDefinition(targetParameter.type || "any", parameterOverride.type);

                                if (convertToArray) {
                                    targetParameter.type = <ArrayType>{
                                        kind: "array",
                                        originalType: originalArrayType,
                                        type: targetParameter.type
                                    }
                                }
                            }

                            parameterOverride._processed = true;
                        }
                        //override.parameters
                    }
                    if (override.returnTypes !== undefined) {
                        targetElement.returnTypes = overrideReturnType(targetElement.returnTypes || [], override.returnTypes);
                    }
                    if (override.returnIsArray !== undefined) {
                        throw new Error("Overriding return type as an array on a system method is not currently implemented");
                    }
    
                    override._processed = true;
                }
    
            } else {
                override._issues.push(`Unexpected operation ${override._operation} for element ${override.name}`);
            }
        }
    }

    return fullElementList;
}

function overrideReturnType(returnTypes: ReturnedType[], overrideDefinition?: (OverrideReturnTypeDefinitionSelector | MethodReturnTypeOverride)[]): ReturnedType[] {
    let targetReturnTypes = cloneDeep(returnTypes) || []
    if (overrideDefinition === undefined) return targetReturnTypes;
    for (const returnTypeOverride of overrideDefinition) {
        if (isOverrideReturnTypeDefinitionSelector(returnTypeOverride)) {
            returnTypeOverride._processed = false;
            returnTypeOverride._issues = []
            if (targetReturnTypes === undefined) {
                returnTypeOverride._issues.push("Return types was empty, there was nothing to select from");
                continue;
            }

            function findByType(type: Type, criteria: string): boolean {
                if (isArrayType(type)) {
                    return type.originalType === criteria;
                }

                return type === criteria;
            }

            const override = returnTypeOverride.override

            const targetReturnType = targetReturnTypes.find(trt => findByType(trt.type, returnTypeOverride.findByType));
            if (!targetReturnType) {
                returnTypeOverride._issues.push(`could not find a target return type of ${returnTypeOverride.findByType}`);
            } else if (override._operation === "remove") {
                targetReturnTypes = targetReturnTypes.filter(trt => trt !== targetReturnType);
                override._processed = true;
            } else if (override._operation === "change" || override._operation === undefined) {
                if (override.description !== undefined) {
                    targetReturnType.description = override.description;
                }
                if (override.isArray !== undefined) {
                    targetReturnType.value = override.value;
                }
                if (override.type !== undefined) {
                    let convertToArray = override.isArray;
                    let originalArrayType = undefined;

                    if (isArrayType(targetReturnType.type)) {
                        originalArrayType = targetReturnType.type.originalType;
                        targetReturnType.type = targetReturnType.type.type;
                        convertToArray = convertToArray === undefined ? true : convertToArray
                    }

                    const tempType: ObjectType = {
                        kind: "object",
                        fields: [
                            {
                                name: "return",
                                description: targetReturnType.description,
                                type: targetReturnType.type,
                                defaultValue: targetReturnType.value
                            }
                        ]
                    }
                    const tempOverride: ObjectTypeOverride = {
                        "return": override.type
                    }

                    targetReturnType.type = overrideTypeDefinition(tempType || "any", tempOverride);

                    if (isObjectType(targetReturnType.type)) {
                        const temp = targetReturnType.type.fields.find(f => f.name === "return");
                        if (temp) {
                            targetReturnType.type = temp.type;
                        }
                    }

                    if (convertToArray) {
                        targetReturnType.type = <ArrayType>{
                            kind: "array",
                            originalType: originalArrayType,
                            type: targetReturnType.type
                        }
                    }
                }

                override._processed = true;
            }
        }
    }
    return targetReturnTypes;
}

function isOverrideReturnTypeDefinitionSelector(override: (OverrideReturnTypeDefinitionSelector | MethodReturnTypeOverride)): override is OverrideReturnTypeDefinitionSelector {
    return (<any>override).findByType !== undefined;
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

export function verifyAllOverridesConsumed(overrides: IScriptingDocumentationOverrides) {
    const checkingOverrides = cloneDeep(overrides.overrides);
    const elementsToCheck = [];
    if (checkingOverrides.systemMethods) {
        elementsToCheck.push(checkingOverrides.systemMethods);
    }
    if (checkingOverrides.component) {
        elementsToCheck.push(checkingOverrides.component);
    }
    if (checkingOverrides.event) {
        if (checkingOverrides.event.client) {
            if (checkingOverrides.event.client.listening) {
                elementsToCheck.push(checkingOverrides.event.client.listening);
            }
            if (checkingOverrides.event.client.triggerable) {
                elementsToCheck.push(checkingOverrides.event.client.triggerable);
            }
        }
        if (checkingOverrides.event.server) {
            if (checkingOverrides.event.server.listening) {
                elementsToCheck.push(checkingOverrides.event.server.listening);
            }
            if (checkingOverrides.event.server.triggerable) {
                elementsToCheck.push(checkingOverrides.event.server.triggerable);
            }
        }
    }

    const allElementsRemoved = elementsToCheck.reduce((p, c) => removeProcessedComponents(c) && p, true);
    const cleanedOutput = cleanDeep(checkingOverrides, { emptyString: false, nullValues: false });

    if (!allElementsRemoved) {
        console.warn("There are issues in the overrides:");
        console.log(JSON.stringify(cleanedOutput, undefined, 2));
    }
}

function removeProcessedComponents(items?: any): boolean {
    if (!items) return true;

    let allItemsTouched = true;
    
    if (isObject(items)) {
        for (const [name, tempItem] of Object.entries(items)) {
            let allChildItemsTouched = true;
            let item = <DebugTracking>tempItem;
            
            if ((isArray(tempItem) && tempItem.length > 0) || isObject(tempItem)) {
                allChildItemsTouched = allChildItemsTouched && removeProcessedComponents(tempItem);
            }

            allItemsTouched = allItemsTouched && allChildItemsTouched && (item._processed === undefined || !!item._processed);

            if (item._processed) {
                if (allChildItemsTouched) {
                    delete items[name];
                }
                delete item._processed;
            }
        }
    }

    return allItemsTouched;
}
