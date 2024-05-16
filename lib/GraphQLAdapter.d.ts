import { BaseDatabase, BaseResource } from "adminjs";
import { GraphQLConnection } from "./index.js";
import { GraphQLResourceAdapter } from "./GraphQLResource.js";
declare class GraphQLDatabaseAdapter extends BaseDatabase {
    readonly connection: GraphQLConnection;
    constructor(connection: GraphQLConnection);
    resources(): Array<BaseResource>;
    static isAdapterFor(connection: GraphQLConnection): boolean;
}
export declare const GraphQLAdapter: {
    Database: typeof GraphQLDatabaseAdapter;
    Resource: typeof GraphQLResourceAdapter;
};
export {};
//# sourceMappingURL=GraphQLAdapter.d.ts.map