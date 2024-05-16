import Axios from "axios";
import { Agent as HTTPAgent } from "http";
import { Agent as HTTPSAgent } from "https";
/**
 * A minimal GraphQL client.
 */
export class GraphQLClient {
    axios;
    constructor(endpoint, agentOptions = {}) {
        const httpAgent = new HTTPAgent(agentOptions);
        const httpsAgent = new HTTPSAgent(agentOptions);
        this.axios = Axios.create({
            baseURL: endpoint,
            headers: {
                "content-type": "application/graphql+json",
            },
            httpAgent,
            httpsAgent,
        });
    }
    async request(query, variables, headers) {
        const body = {
            query,
            variables
        };
        const response = await this.axios.post("/", body, {
            headers
        });
        return response.data;
    }
}
//# sourceMappingURL=GraphQLClient.js.map