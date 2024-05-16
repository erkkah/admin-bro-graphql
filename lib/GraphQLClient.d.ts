/// <reference types="node" resolution-mode="require"/>
import { GraphQLFormattedError } from "graphql";
import { AgentOptions } from "http";
/**
 * A minimal GraphQL client.
 */
export declare class GraphQLClient {
    private readonly axios;
    constructor(endpoint: string, agentOptions?: AgentOptions);
    request<T = Record<string, unknown>>(query: string, variables?: Record<string, unknown>, headers?: Record<string, string>): Promise<GraphQLClientResponse<T>>;
}
export interface GraphQLClientResponse<T> {
    data: T;
    errors: GraphQLFormattedError[];
}
//# sourceMappingURL=GraphQLClient.d.ts.map