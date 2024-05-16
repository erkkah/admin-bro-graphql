import { DocumentNode, GraphQLNamedType } from "graphql";
import { ParamsType, BaseResource, BaseRecord, Filter } from "adminjs";
import { GraphQLConnection } from "./index.js";
import { GraphQLPropertyAdapter } from "./GraphQLProperty.js";
/**
 * The actual GraphQL query/mutation that will be called to
 * interact with the remote API.
 */
export interface GraphQLQueryMapping<T> {
    query: string | DocumentNode;
    variables?: Record<string, unknown>;
    parseResult(result: Record<string, unknown>): T;
}
/**
 * Pagination and sorting options passed to the find operation.
 */
export interface FindOptions {
    limit?: number;
    offset?: number;
    sort?: {
        sortBy?: string;
        direction?: "asc" | "desc";
    };
}
/**
 * GraphQLResource is the definition of how a GraphQL resource
 * is mapped to an AdminBro resource.
 */
export interface GraphQLResource {
    id: string;
    sortableFields?: string[];
    referenceFields?: {
        [field: string]: string;
    };
    makeSubproperties?: boolean;
    count: (filter: FieldFilter[]) => GraphQLQueryMapping<number>;
    find: (filter: FieldFilter[], options: FindOptions) => GraphQLQueryMapping<ParamsType[]>;
    findOne: (id: string | number) => GraphQLQueryMapping<ParamsType | null>;
    create?: (record: ParamsType) => GraphQLQueryMapping<ParamsType>;
    update?: (id: string | number, record: ParamsType) => GraphQLQueryMapping<ParamsType>;
    delete?: (id: string | number) => GraphQLQueryMapping<void>;
}
/**
 * Filter operations for use in field filters.
 * `MATCH` performs implementation (API) specific matching, and is used
 * for filtering on string fields.
 */
export type FilterOperation = "GTE" | "LTE" | "EQ" | "MATCH";
/**
 * A filtering operation.
 * The "than" and "to" fields specify the compare operand to the
 * filter operation.
 */
export interface FieldFilter {
    field: string;
    is: FilterOperation;
    than?: unknown;
    to?: unknown;
}
export type InternalGraphQLResource = GraphQLResource & {
    tag: "GraphQLResource";
    connection?: GraphQLConnection;
    properties?: GraphQLPropertyAdapter[];
    typeMap?: Map<string, GraphQLNamedType>;
};
export declare class GraphQLResourceAdapter extends BaseResource {
    readonly rawResource: InternalGraphQLResource;
    private readonly connection;
    private readonly propertyMap;
    constructor(rawResource: InternalGraphQLResource);
    databaseName(): string;
    databaseType(): string;
    id(): string;
    properties(): GraphQLPropertyAdapter[];
    property(path: string): GraphQLPropertyAdapter | null;
    count(filter: Filter): Promise<number>;
    find(filter: Filter, options: FindOptions): Promise<BaseRecord[]>;
    findOne(id: string | number): Promise<BaseRecord | null>;
    findMany(ids: Array<string | number>): Promise<BaseRecord[]>;
    private convertParams;
    private validateParams;
    create(params: ParamsType): Promise<ParamsType>;
    update(id: string, params: ParamsType): Promise<ParamsType>;
    delete(id: string): Promise<void>;
    static isAdapterFor(resource: GraphQLResource): boolean;
    private executeMapping;
    private mapFilter;
}
declare function inflateParams(params: Record<string, unknown>): Record<string, unknown>;
declare function deflateParams<T>(params: T, IDField?: string): T;
export declare const _testing: {
    inflateParams: typeof inflateParams;
    deflateParams: typeof deflateParams;
};
export {};
//# sourceMappingURL=GraphQLResource.d.ts.map