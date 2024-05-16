import { getIntrospectionQuery, buildClientSchema, parse, visit, TypeInfo, visitWithTypeInfo, isWrappingType, GraphQLEnumType, GraphQLList, GraphQLObjectType, GraphQLID, GraphQLNonNull, } from "graphql";
import { GraphQLClient } from "./GraphQLClient.js";
import { GraphQLPropertyAdapter } from "./GraphQLProperty.js";
/**
 * GraphQLConnection connects to a GraphQL API, and initializes a list of
 * configured resources with data from the remote API schema, so that they
 * can be used as AdminBro resources.
 */
export class GraphQLConnection {
    resources;
    onError;
    tag = "GraphQLConnection";
    client;
    name;
    headers;
    constructor(resources, options, onError) {
        this.resources = resources;
        this.onError = onError;
        this.name = options?.name ?? "graphql";
        const url = options?.url ?? "http://localhost:3000/graphql";
        this.client = new GraphQLClient(url, options?.agentOptions);
        this.headers = options?.headers;
    }
    get r() {
        return this.resources.reduce((map, resource) => {
            map[resource.id] = resource;
            return map;
        }, {});
    }
    async init() {
        const fullSchema = await this.fetchSchema();
        await this.inflateResources(fullSchema);
    }
    async fetchSchema() {
        const query = getIntrospectionQuery({ descriptions: false });
        const result = await this.request(query);
        return buildClientSchema(result);
    }
    static graphQLTypeToPropertyType(graphQLType) {
        switch (graphQLType.name) {
            case "String":
            case "ID":
                return "string";
            case "Float":
                return "float";
            case "Int":
                return "number";
            case "Bool":
                return "boolean";
            case "Date":
                return "datetime";
            default:
                return "mixed";
        }
    }
    async inflateResources(schema) {
        this.resources
            .map((res) => res)
            .map((resource) => {
            const findMapping = resource.findOne(42);
            let parsed = typeof findMapping.query === "string"
                ? parse(findMapping.query)
                : findMapping.query;
            const typeInfo = new TypeInfo(schema);
            const path = [];
            resource.typeMap = new Map();
            resource.connection = this;
            resource.tag = "GraphQLResource";
            parsed = expandFragments(parsed);
            const operationDefinition = parsed.definitions.find((def) => def.kind === "OperationDefinition");
            if (!operationDefinition) {
                throw new Error("Document without operation is not allowed");
            }
            const toplevelSelections = operationDefinition.selectionSet.selections;
            if (toplevelSelections.length !== 1) {
                throw new Error("Top level selections must contain exactly one field");
            }
            const topNode = operationDefinition;
            // Initialize with "root" object
            const objectStack = [[]];
            const propertyMap = new Map();
            visit(topNode, visitWithTypeInfo(typeInfo, {
                Field: {
                    enter: (field) => {
                        const parentType = typeInfo.getParentType();
                        if (parentType?.name === "Query" ||
                            parentType?.name === "Mutation") {
                            return;
                        }
                        const fieldName = field.name.value;
                        let graphQLType = typeInfo.getType();
                        if (!graphQLType) {
                            throw new Error(`Unexpected empty type for field "${fieldName}" of resource "${resource.id}"`);
                        }
                        let isArray = false;
                        let isRequired = false;
                        while (isWrappingType(graphQLType)) {
                            if (graphQLType instanceof GraphQLList) {
                                isArray = true;
                            }
                            else if (graphQLType instanceof GraphQLNonNull &&
                                !isArray) {
                                isRequired = true;
                            }
                            graphQLType =
                                graphQLType.ofType;
                        }
                        const namedType = graphQLType;
                        let enumValues;
                        if (namedType instanceof GraphQLEnumType) {
                            enumValues = namedType
                                .getValues()
                                .map((val) => val.value);
                        }
                        const parentPath = path.join(".");
                        const propertyPath = [...path, fieldName].join(".");
                        let propertyType;
                        let referencing;
                        if (namedType instanceof GraphQLObjectType) {
                            const objectFields = namedType.getFields();
                            const selections = field.selectionSet?.selections ?? [];
                            if (selections.length === 1 &&
                                selections[0].kind === "Field") {
                                const fieldName = selections[0].name.value;
                                const objectField = objectFields[fieldName];
                                if (!objectField) {
                                    throw new Error(`Field ${fieldName} is not in ${namedType.name}`);
                                }
                                const fieldType = objectField.type;
                                if (typeIsID(fieldType)) {
                                    propertyType = "reference";
                                    referencing = namedType.name;
                                }
                            }
                        }
                        if (!propertyType) {
                            propertyType =
                                (propertyPath in
                                    (resource.referenceFields ?? {}) &&
                                    "reference") ||
                                    (enumValues?.length && "string") ||
                                    GraphQLConnection.graphQLTypeToPropertyType(namedType);
                        }
                        const isSortable = resource.sortableFields
                            ? resource.sortableFields.includes(propertyPath)
                            : propertyType != "reference";
                        const parentProperty = propertyMap.get(parentPath);
                        const useFullPath = !resource.makeSubproperties &&
                            !(parentProperty?.type() === "mixed" &&
                                parentProperty?.isArray());
                        const property = new GraphQLPropertyAdapter({
                            path: useFullPath
                                ? propertyPath
                                : fieldName,
                            type: propertyType,
                            isId: namedType.name === "ID" &&
                                propertyType !== "reference",
                            isSortable: isSortable,
                            referencing: referencing ??
                                resource.referenceFields?.[propertyPath],
                            enumValues,
                            isArray,
                            isRequired,
                        });
                        objectStack[objectStack.length - 1].push(property);
                        propertyMap.set(propertyPath, property);
                        resource.typeMap?.set(propertyPath, namedType);
                        if (field.selectionSet) {
                            path.push(fieldName);
                            objectStack.push([]);
                        }
                    },
                    leave: (field) => {
                        const parentType = typeInfo.getParentType()?.name;
                        if (parentType === "Query" ||
                            parentType === "Mutation") {
                            return;
                        }
                        if (field.selectionSet) {
                            path.pop();
                            const currentObject = objectStack.pop();
                            if (currentObject === undefined) {
                                throw new Error("Unexpected empty object");
                            }
                            const lastObject = objectStack[objectStack.length - 1];
                            const lastProperty = lastObject[lastObject.length - 1];
                            if (lastProperty &&
                                ((lastProperty.type() === "mixed" &&
                                    lastProperty.isArray()) ||
                                    resource.makeSubproperties)) {
                                lastProperty.setSubProperties(currentObject);
                            }
                            else if (currentObject.length !== 1 ||
                                !currentObject[0].isId()) {
                                lastObject.push(...currentObject);
                            }
                        }
                    },
                },
            }));
            resource.properties = objectStack
                .pop()
                ?.filter((prop) => prop.type() !== "mixed" ||
                prop.subProperties().length);
        });
    }
    formatGraphQLErrors(errors) {
        return ("GraphQL request error: " +
            errors.map((error) => error.message).join(", "));
    }
    async request(document, variables) {
        try {
            const headers = this.headers?.();
            const response = await this.client.request(document, variables, headers);
            if (response.errors?.length) {
                this.reportAndThrow(new Error(this.formatGraphQLErrors(response.errors)), response.errors);
            }
            return response.data;
        }
        catch (thrown) {
            let error = thrown;
            const axiosError = error;
            // @ts-ignore
            const graphQLErrors = axiosError.response?.data?.errors;
            if (graphQLErrors) {
                error = new Error(this.formatGraphQLErrors(graphQLErrors));
            }
            this.reportAndThrow(error, graphQLErrors);
        }
    }
    reportAndThrow(error, originalErrors) {
        this.onError?.(error, originalErrors);
        throw error;
    }
}
function expandFragments(node) {
    const fragmentDefinitions = node.definitions.filter((def) => def.kind === "FragmentDefinition");
    return visit(node, {
        FragmentSpread: (spread) => {
            const fragment = fragmentDefinitions.find((def) => def.name.value === spread.name.value);
            if (!fragment) {
                throw new Error("Invalid spread reference");
            }
            return fragment.selectionSet;
        },
    });
}
function typeIsID(fieldType) {
    while (isWrappingType(fieldType)) {
        fieldType = fieldType.ofType;
    }
    return fieldType === GraphQLID;
}
//# sourceMappingURL=GraphQLConnection.js.map