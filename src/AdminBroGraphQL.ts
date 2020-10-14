import {
    BaseDatabase,
    BaseProperty,
    BaseResource,
    BaseRecord,
    Filter,
    PropertyType,
    ParamsType,
    ForbiddenError
} from "admin-bro";

import {
    getIntrospectionQuery,
    buildClientSchema,
    GraphQLSchema,
    parse,
    visit,
    TypeInfo,
    visitWithTypeInfo,
    getNamedType,
    GraphQLNamedType,
    isInputType,
    coerceValue,
    IntrospectionQuery
} from "graphql";

import { GraphQLClient } from "./GraphQLClient";

export class GraphQLConnection {
    readonly tag = "GraphQLConnection";
    private readonly client: GraphQLClient;

    constructor(
        public readonly connection: { name: string, url: string } = {
            name: "graphql", url: "http://localhost:3000/graphql"
        },
        public readonly resources: GraphQLResourceMap
    ) {
        this.client = new GraphQLClient(connection.url);
    }

    async init(): Promise<void> {
        await Promise.all(
            Object.values(this.resources).map((res) => res as InternalGraphQLResource)
                .map(async (resource) => {
                    const findMapping = resource.findOne(42);
                    const parsed = parse(findMapping.query);
                    const fullSchema = await this.fetchSchema();
                    const typeInfo = new TypeInfo(fullSchema);
                    const path: string[] = [];
                    resource.properties = [];
                    resource.typeMap = new Map();

                    visit(parsed, visitWithTypeInfo(typeInfo, {
                        Field: (field) => {
                            const fieldName = field.alias?.value ?? field.name.value;
                            if (field.selectionSet) {
                                path.push(fieldName);
                            } else {
                                const graphQLType = typeInfo.getType();
                                if (!graphQLType) {
                                    throw new Error("Unexpected empty type");
                                }
                                const namedType = getNamedType(graphQLType);
                                const propertyID = [...path, fieldName].join(".");
                                const propertyType = resource.fieldTypeOverrides?.[propertyID] ||
                                    GraphQLConnection.graphQLTypeToPropertyType(namedType);
                                resource.properties?.push(
                                    new GraphQLPropertyAdapter({
                                        path: propertyID,
                                        type: propertyType,
                                        isId: namedType.name === "ID",
                                        isSortable: resource.sortableFields?.includes(propertyID) ?? true,
                                        position: resource.fieldOrder?.indexOf(propertyID) ?? 0,
                                    })
                                );
                                resource.typeMap?.set(propertyID, namedType);
                                resource.connection = this;
                                resource.tag = "GraphQLResource";
                            }
                        }
                    }));
                }));
    }

    private async fetchSchema(): Promise<GraphQLSchema> {
        const query = getIntrospectionQuery({ descriptions: false });
        const result = await this.client.request<IntrospectionQuery>(query);
        return buildClientSchema(result.data);
    }

    private static graphQLTypeToPropertyType(graphQLType: GraphQLNamedType): PropertyType {
        switch (graphQLType.name) {
        case "String":
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

    async request<T = Record<string, unknown>>(document: string, variables?: Record<string, unknown>): Promise<T> {
        const response = await this.client.request<T>(document, variables);
        if (response.errors?.length) {
            throw new Error("Failed to execute request: " + response.errors.join(", "));
        }
        return response.data;
    }
}

export interface GraphQLQueryMapping<T> {
    query: string;
    variables?: Record<string, unknown>;
    parseResult(response: Record<string, unknown>): T;
}

export interface GraphQLResource {
    id: string;

    sortableFields?: string[];
    fieldOrder?: string[];
    fieldTypeOverrides?: { [field: string]: PropertyType };

    // queries:
    count: (filter: FieldFilter[]) => GraphQLQueryMapping<number>;
    find: (filter: FieldFilter[], options: FindOptions) => GraphQLQueryMapping<BaseRecord[]>;
    findOne: (id: string | number) => GraphQLQueryMapping<BaseRecord | null>;

    // mutations:
    create?: (record: ParamsType) => GraphQLQueryMapping<ParamsType>;
    update?: (id: string | number, record: ParamsType) => GraphQLQueryMapping<ParamsType>;
    delete?: (id: string | number) => GraphQLQueryMapping<void>;
}

export interface FieldFilter {
    field: string;
    from: string | number | Date;
    to: string | number | Date;
}

export interface FindOptions {
    limit?: number;
    offset?: number;
    sort?: {
        sortBy?: string;
        direction?: "asc" | "desc";
    }
}

type InternalGraphQLResource = GraphQLResource & {
    tag: "GraphQLResource";
    connection?: GraphQLConnection;
    properties?: GraphQLPropertyAdapter[];
    typeMap?: Map<string, GraphQLNamedType>;
}

interface GraphQLResourceMap {
    [key: string]: GraphQLResource
}

class GraphQLResourceAdapter extends BaseResource {
    private readonly connection: GraphQLConnection;
    private readonly propertyMap: Map<string, GraphQLPropertyAdapter>;

    constructor(public readonly rawResource: InternalGraphQLResource) {
        super(rawResource);

        if (!rawResource.connection) {
            throw new Error("Uninitialized resource");
        }
        this.connection = rawResource.connection;
        this.propertyMap = new Map(
            rawResource.properties?.map((prop) => [prop.path(), prop]) ?? []);
    }

    databaseName(): string {
        return this.connection.connection.name;
    }

    databaseType(): string {
        return "graphql";
    }

    id(): string {
        return this.rawResource.id;
    }

    properties(): GraphQLPropertyAdapter[] {
        return [...this.propertyMap.values()];
    }

    property(path: string): GraphQLPropertyAdapter | null {
        return this.propertyMap.get(path) ?? null;
    }

    async count(filter: Filter): Promise<number> {
        const fieldFilter = this.mapFilter(filter);
        const mapping = this.rawResource.count(fieldFilter);
        return this.executeMapping(mapping);
    }

    async find(filter: Filter, options: FindOptions): Promise<BaseRecord[]> {
        const fieldFilter = this.mapFilter(filter);
        const mapping = this.rawResource.find(fieldFilter, options);
        return this.executeMapping(mapping);
    }

    async findOne(id: string | number): Promise<BaseRecord | null> {
        const mapping = this.rawResource.findOne(id);
        return this.executeMapping(mapping);
    }

    async findMany(ids: Array<string | number>): Promise<BaseRecord[]> {
        const resolved = await Promise.all(
            ids.map((id) => this.findOne(id))
        );
        return resolved.filter<BaseRecord>((record): record is BaseRecord => (record != null));
    }

    async create(params: ParamsType): Promise<ParamsType> {
        const mapping = this.rawResource.create?.(params);
        if (!mapping) {
            throw new ForbiddenError("Resource is not editable");
        }
        return this.executeMapping(mapping);
    }

    async update(id: string, params: ParamsType): Promise<ParamsType> {
        const mapping = this.rawResource.update?.(id, params);
        if (!mapping) {
            throw new ForbiddenError("Resource is not editable");
        }
        return this.executeMapping(mapping);
    }

    async delete(id: string): Promise<void> {
        const mapping = this.rawResource.delete?.(id);
        if (!mapping) {
            throw new ForbiddenError("Resource is not editable");
        }
        this.executeMapping(mapping);
    }

    static isAdapterFor(resource: GraphQLResource): boolean {
        const internalResource = resource as InternalGraphQLResource;
        return internalResource.tag == "GraphQLResource";
    }

    private async executeMapping<T = Record<string, unknown>>(mapping: GraphQLQueryMapping<T>): Promise<T> {
        const result = await this.connection.request(mapping.query, mapping.variables);
        return mapping.parseResult(result);
    }

    private mapFilter(filter: Filter): FieldFilter[] {
        return filter.reduce<FieldFilter[]>((mapped, element) => {
            const from = typeof element.value == "string" ? element.value : element.value.from;
            const to = typeof element.value == "string" ? from : element.value.to;

            const graphQLType = this.rawResource.typeMap?.get(element.path);
            if (!graphQLType || !isInputType(graphQLType)) {
                throw new Error(`Cannot get valid GraphQL type from ${this.rawResource.id}:${element.path}`);
            }

            const coercedFrom = coerceValue(from, graphQLType);
            if (coercedFrom.errors?.length) {
                throw new Error(`Cannot coerce "from" value from ${from} to ${graphQLType}: ${coercedFrom.errors}`);
            }

            const coercedTo = coerceValue(to, graphQLType);
            if (coercedTo.errors?.length) {
                throw new Error(`Cannot coerce "to" value from ${from} to ${graphQLType}: ${coercedTo.errors}`);
            }

            mapped.push({
                field: element.property.path(),
                from: coercedFrom.value,
                to: coercedTo.value,
            });
            return mapped;
        }, []);
    }

}



interface BasePropertyAttrs {
    path: string;
    type?: PropertyType;
    isId?: boolean;
    isSortable?: boolean;
    position?: number;
}

class GraphQLPropertyAdapter extends BaseProperty {
    constructor(property: BasePropertyAttrs) {
        super(property);
    }
}

class GraphQLDatabaseAdapter extends BaseDatabase {
    public constructor(public readonly connection: GraphQLConnection) {
        super(connection);
    }

    public resources(): Array<BaseResource> {
        return Object.values(this.connection.resources)
            .map((r) => new GraphQLResourceAdapter(r as InternalGraphQLResource));
    }

    public static isAdapterFor(connection: GraphQLConnection): boolean {
        return connection.tag == "GraphQLConnection";
    }
}

export const GraphQLAdapter = {
    Database: GraphQLDatabaseAdapter,
    Resource: GraphQLResourceAdapter,
};
