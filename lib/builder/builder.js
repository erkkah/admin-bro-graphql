/**
 * Builds a `GraphQLResource` from pieces.
 */
export function buildResource(pieces) {
    const IDField = pieces.ID || "ID";
    const singular = pieces.singular || pieces.type[0].toLowerCase() + pieces.type.slice(1);
    const plural = pieces.plural || singular + "s";
    const fragmentString = (typeof pieces.fragment === "string"
        ? pieces.fragment
        : pieces.fragment.loc?.source.body)?.trim();
    const queryDirectives = pieces.queryDirectives ?? "";
    const inputType = pieces.inputType || `${pieces.type}Input`;
    const upperTail = singular[0].toUpperCase() + singular.slice(1);
    const createMutation = pieces.mutations?.create || "create" + upperTail;
    const updateMutation = pieces.mutations?.update || "update" + upperTail;
    const deleteMutation = pieces.mutations?.delete || "delete" + upperTail;
    const mapInputValue = (v) => {
        return {
            ...Object.keys(v).reduce((value, key) => {
                value[pieces.inputFieldMap?.[key] ?? key] = v[key];
                return value;
            }, {}),
            ...pieces.mapInputValue?.(v),
        };
    };
    if (!fragmentString) {
        throw new Error("Unexpected empty fragment");
    }
    if (!fragmentString.startsWith("{") || !fragmentString.endsWith("}")) {
        throw new Error("Fragment must be specified within curly brackets");
    }
    return {
        id: pieces.type,
        count: (filter) => ({
            query: `
            query($filter: [FilterInput!]) ${queryDirectives} {
                count: ${pieces.queries?.count || `${singular}Count`}(filter: $filter)
            }`,
            variables: {
                filter: filter.map((entry) => ({
                    ...entry,
                    field: pieces.inputFieldMap?.[entry.field] ?? entry.field,
                })),
            },
            parseResult(response) {
                return response.count;
            },
        }),
        find: (filter, options) => ({
            query: `
            query($filter: [FilterInput!], $sorting: SortingInput, $offset: Int, $limit: Int) ${queryDirectives} {
                q: ${pieces.queries?.find || plural}(filter: $filter, sorting: $sorting, offset: $offset, limit:$limit) {
                    ...fields
                }
            }
            fragment fields on ${pieces.type} ${fragmentString} `,
            variables: (() => {
                const sortField = options.sort?.sortBy;
                const sortOrder = options.sort?.direction?.toUpperCase();
                const sorting = sortField
                    ? {
                        sorting: {
                            by: sortField,
                            order: sortOrder ?? "ASC",
                        },
                    }
                    : undefined;
                const offset = options.offset
                    ? {
                        offset: options.offset,
                    }
                    : undefined;
                const limit = options.limit
                    ? {
                        limit: options.limit,
                    }
                    : undefined;
                return {
                    filter: filter.map((entry) => ({
                        ...entry,
                        field: pieces.inputFieldMap?.[entry.field] ?? entry.field,
                    })),
                    ...sorting,
                    ...offset,
                    ...limit,
                };
            })(),
            parseResult(response) {
                return response.q;
            },
        }),
        findOne: (ID) => ({
            query: `
            query($ID: ID!) ${queryDirectives} {
                q: ${pieces.queries?.get || singular} (${IDField}: $ID) {
                    ...fields
                }
            }
            fragment fields on ${pieces.type} ${fragmentString} `,
            variables: {
                ID,
            },
            parseResult(response) {
                return response.q;
            },
        }),
        create: (entity) => ({
            query: `
            mutation($input: ${inputType}!) ${queryDirectives} {
                m: ${createMutation} (input: $input) {
                    ...fields
                }
            }
            fragment fields on ${pieces.type} ${fragmentString} `,
            variables: {
                input: mapInputValue(entity),
            },
            parseResult(response) {
                return response.m;
            },
        }),
        update: (ID, entity) => ({
            query: `
            mutation($ID: ID!, $update: ${inputType}!) ${queryDirectives} {
                m: ${updateMutation} (${IDField}: $ID, update: $update) {
                    ...fields
                }
            }
            fragment fields on ${pieces.type} ${fragmentString} `,
            variables: {
                ID,
                update: bodyOf(mapInputValue(entity)),
            },
            parseResult(response) {
                return response.m;
            },
        }),
        delete: (ID) => ({
            query: `
            mutation($ID: ID!) ${queryDirectives} {
                m: ${deleteMutation} (${IDField}: $ID)
            }
            `,
            variables: {
                ID,
            },
            parseResult() {
                //
            },
        }),
    };
}
/**
 * Extends `buildResource` with configuration options to
 * build a fully configured resource.
 *
 * This keeps GraphQL resource definition and AdminBro
 * configuration of the resource in one place.
 */
export function configureResource(options) {
    const resource = {
        ...buildResource({
            ...options.pieces,
            type: options.type,
        }),
        ...options.extras,
    };
    const configuration = (connection) => ({
        resource: connection.r[options.type],
        options: options.options ?? {},
        features: options.features,
    });
    const translations = options.resourceTranslations
        ? {
            [options.type]: options.resourceTranslations,
        }
        : undefined;
    return {
        resource,
        configuration,
        // @ts-ignore
        translations,
    };
}
function bodyOf(entity) {
    const body = {
        ...entity,
    };
    delete body.ID;
    return body;
}
//# sourceMappingURL=builder.js.map