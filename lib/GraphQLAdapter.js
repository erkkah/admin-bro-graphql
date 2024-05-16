import { BaseDatabase } from "adminjs";
import { GraphQLResourceAdapter, } from "./GraphQLResource.js";
class GraphQLDatabaseAdapter extends BaseDatabase {
    connection;
    constructor(connection) {
        super(connection);
        this.connection = connection;
    }
    resources() {
        return this.connection.resources.map((r) => new GraphQLResourceAdapter(r));
    }
    static isAdapterFor(connection) {
        return connection.tag == "GraphQLConnection";
    }
}
export const GraphQLAdapter = {
    Database: GraphQLDatabaseAdapter,
    Resource: GraphQLResourceAdapter,
};
//# sourceMappingURL=GraphQLAdapter.js.map