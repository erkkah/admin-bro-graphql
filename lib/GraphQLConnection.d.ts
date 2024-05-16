/// <reference types="node" resolution-mode="require"/>
import { AgentOptions } from "http";
import { GraphQLFormattedError } from "graphql";
import { GraphQLClient } from "./GraphQLClient.js";
import { GraphQLResource } from "./GraphQLResource.js";
/**
 * Options for the GraphQL connection.
 * Use `headers` to set api key, et.c.
 */
export interface ConnectionOptions {
    name?: string;
    url?: string;
    headers?: () => Record<string, string>;
    agentOptions?: AgentOptions;
}
/**
 * GraphQLConnection connects to a GraphQL API, and initializes a list of
 * configured resources with data from the remote API schema, so that they
 * can be used as AdminBro resources.
 */
export declare class GraphQLConnection {
    readonly resources: GraphQLResource[];
    private readonly onError?;
    readonly tag = "GraphQLConnection";
    readonly client: GraphQLClient;
    readonly name: string;
    private readonly headers?;
    constructor(resources: GraphQLResource[], options?: ConnectionOptions, onError?: ((error: Error, originalErrors?: GraphQLFormattedError[]) => void) | undefined);
    get r(): GraphQLResourceMap;
    init(): Promise<void>;
    private fetchSchema;
    private static graphQLTypeToPropertyType;
    private inflateResources;
    private formatGraphQLErrors;
    request<T = Record<string, unknown>>(document: string, variables?: Record<string, unknown>): Promise<T>;
    reportAndThrow(error: Error, originalErrors?: GraphQLFormattedError[]): never;
}
interface GraphQLResourceMap {
    [key: string]: GraphQLResource;
}
export {};
//# sourceMappingURL=GraphQLConnection.d.ts.map