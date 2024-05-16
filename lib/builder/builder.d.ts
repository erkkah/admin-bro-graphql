import { DocumentNode } from "graphql";
import { GraphQLResource, GraphQLConnection } from "../index.js";
import { ResourceWithOptions, ResourceOptions, LocaleTranslations, LocaleTranslationsBlock, FeatureType } from "adminjs";
export type Entity = Record<string, any>;
/**
 * A descriptor for the different pieces that make a resource,
 * passed to `buildResource` to create a GraphQLResource instance.
 */
export interface BuildResourcePieces {
    /**
     * A GQL fragment, describing the field structure that will be exposed
     * to AdminBro as the representation of the resource.
     *
     * Example:
     * ```gql
     *  {
     *      ID
     *      name
     *  }
     * ```
     */
    fragment: string | DocumentNode;
    /**
     * The GraphQL type name of the resource.
     */
    type: string;
    /**
     * The GraphQL input type for the resource.
     * Defaults to `type.toLowerCase() + "Input"`.
     */
    inputType?: string;
    /**
     * Maps from adminjs entity field names to corresponding GraphQL field names
     * for count and find filtering, create and update.
     *
     * By default, the adminjs object is passed as is without any renaming of fields.
     */
    inputFieldMap?: Record<string, string>;
    /**
     * Extends the default mapping from adminjs entity to the corresponding
     * GraphQL input object for create and update mutations.
     *
     * Note that this extends the default mapping, which might have used the
     * specified `inputFieldMap`. Also, the fields returned are added to the
     * original entity object. Existing fields are replaced.
     *
     * To remove a field, set the value to `undefined`.
     *
     * @param input An AdminBro entity object
     * @returns A subset of fields to replace or add to the object
     */
    mapInputValue?(input: Entity): Entity;
    /**
     * Singular name of the type. Used to as the single object getter
     * query name. Defaults to the type name with an initial small letter.
     */
    singular?: string;
    /**
     * Plural name of the type. Defaults to the type name with added 's'.
     */
    plural?: string;
    /**
     * Name of the GraphQL API ID field, 'ID' by default.
     */
    ID?: string;
    queries?: {
        /**
         * Name of the GraphQL 'count' query, `singular + "Count"` by default.
         */
        count?: string;
        /**
         * Name of the GraphQL 'find' query, `plural` by default.
         */
        find?: string;
        /**
         * Name of the GraphQL 'get' query, `singular` by default.
         */
        get?: string;
    };
    /**
     * Names of the GraphQL mutations. By default the
     * operation plus `singular` with initial capital letter.
     */
    mutations?: {
        create?: string;
        update?: string;
        delete?: string;
    };
    /**
     * Query level directives that will be applied to
     * all queries for this resource.
     */
    queryDirectives?: string;
}
/**
 * Builds a `GraphQLResource` from pieces.
 */
export declare function buildResource(pieces: BuildResourcePieces): GraphQLResource;
export interface ConfiguredResource {
    resource: GraphQLResource;
    configuration(connection: GraphQLConnection): ResourceWithOptions;
    translations?: LocaleTranslations["resources"];
}
/**
 * Resource pieces and corresponding AdminBro configuration
 * options to create a configured resource.
 */
export interface ConfigureResourceOptions {
    /**
     * The GraphQL type name of the resource.
     */
    type: string;
    /**
     * The GraphQL side of the resource configuration
     */
    pieces: Omit<BuildResourcePieces, "type">;
    /**
     * Overrides for the `GraphQLResource` object
     * created from the pieces above.
     */
    extras?: Partial<GraphQLResource>;
    /**
     * AdminBro resource options
     */
    options?: ResourceOptions;
    /**
     * AdminBro resource features
     */
    features?: FeatureType[];
    /**
     * AdminBro resource translations
     */
    resourceTranslations?: Partial<LocaleTranslationsBlock>;
}
/**
 * Extends `buildResource` with configuration options to
 * build a fully configured resource.
 *
 * This keeps GraphQL resource definition and AdminBro
 * configuration of the resource in one place.
 */
export declare function configureResource(options: ConfigureResourceOptions): ConfiguredResource;
//# sourceMappingURL=builder.d.ts.map