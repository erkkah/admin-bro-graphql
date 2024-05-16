import { isInputType, GraphQLScalarType, GraphQLObjectType, GraphQLID, } from "graphql";
import { BaseResource, BaseRecord, ForbiddenError, ValidationError, } from "adminjs";
export class GraphQLResourceAdapter extends BaseResource {
    rawResource;
    connection;
    propertyMap;
    constructor(rawResource) {
        super(rawResource);
        this.rawResource = rawResource;
        if (!rawResource.connection) {
            throw new Error("Uninitialized resource");
        }
        this.connection = rawResource.connection;
        this.propertyMap = new Map(rawResource.properties?.map((prop) => [prop.path(), prop]) ?? []);
    }
    databaseName() {
        return this.connection.name;
    }
    databaseType() {
        return "graphql";
    }
    id() {
        return this.rawResource.id;
    }
    properties() {
        return [...this.propertyMap.values()];
    }
    property(path) {
        return this.propertyMap.get(path) ?? null;
    }
    async count(filter) {
        try {
            const fieldFilter = this.mapFilter(filter);
            const mapping = this.rawResource.count(fieldFilter);
            return await this.executeMapping(mapping);
        }
        catch (error) {
            this.connection.reportAndThrow(error);
        }
    }
    async find(filter, options) {
        try {
            const fieldFilter = this.mapFilter(filter);
            const mapping = this.rawResource.find(fieldFilter, options);
            const result = await this.executeMapping(mapping);
            return result.map((record) => new BaseRecord(record, this));
        }
        catch (error) {
            this.connection.reportAndThrow(error);
        }
    }
    async findOne(id) {
        try {
            const mapping = this.rawResource.findOne(deflateReference(id));
            const result = await this.executeMapping(mapping);
            if (result) {
                return new BaseRecord(result, this);
            }
            return null;
        }
        catch (error) {
            this.connection.reportAndThrow(error);
        }
    }
    async findMany(ids) {
        const resolved = await Promise.all(ids.map((id) => this.findOne(id)));
        return resolved.filter((record) => record != null);
    }
    convertParams(params) {
        const converted = Object.keys(params).reduce((coerced, key) => {
            let value = params[key];
            try {
                if (value != null) {
                    const type = this.rawResource?.typeMap?.get(key);
                    if (type instanceof GraphQLScalarType) {
                        value = type.serialize(value);
                    }
                }
                coerced[key] = value;
                return coerced;
            }
            catch (thrown) {
                const error = thrown;
                if (value === "" && !this.propertyMap.get(key)?.isRequired()) {
                    coerced[key] = null;
                    return coerced;
                }
                throw new ValidationError({
                    [key]: {
                        type: "conversion",
                        message: error.message,
                    },
                });
            }
        }, {});
        return converted;
    }
    validateParams(params) {
        const errors = {};
        const editProperties = this._decorated?.options?.editProperties ?? [];
        for (const key of this.properties().map((p) => p.path())) {
            const property = this._decorated?.getPropertyByKey(key);
            const value = params[key];
            // Skip properties that are not being edited
            if (editProperties.length &&
                !editProperties.includes(property?.property.path() ?? "")) {
                continue;
            }
            // Skip self ID properties
            if (property?.isId() && property?.type() !== "reference") {
                continue;
            }
            const required = property?.options.isRequired ?? property?.isRequired();
            if (required) {
                if (value === "" || value === null || value === undefined) {
                    errors[key] = {
                        type: "required",
                        message: "Required field",
                    };
                }
            }
        }
        if (Object.keys(errors).length) {
            throw new ValidationError(errors);
        }
    }
    async create(params) {
        try {
            const inflated = inflateParams(this.convertParams(params));
            this.validateParams(inflated);
            const mapping = this.rawResource.create?.(inflated);
            if (!mapping) {
                throw new ForbiddenError("Resource is not editable");
            }
            return await this.executeMapping(mapping);
        }
        catch (error) {
            this.connection.reportAndThrow(error);
        }
    }
    async update(id, params) {
        try {
            const inflated = inflateParams(this.convertParams(params));
            this.validateParams(inflated);
            const mapping = this.rawResource.update?.(id, inflated);
            if (!mapping) {
                throw new ForbiddenError("Resource is not editable");
            }
            return await this.executeMapping(mapping);
        }
        catch (error) {
            this.connection.reportAndThrow(error);
        }
    }
    async delete(id) {
        try {
            const mapping = this.rawResource.delete?.(id);
            if (!mapping) {
                throw new ForbiddenError("Resource is not editable");
            }
            await this.executeMapping(mapping);
        }
        catch (error) {
            this.connection.reportAndThrow(error);
        }
    }
    static isAdapterFor(resource) {
        const internalResource = resource;
        return internalResource.tag == "GraphQLResource";
    }
    async executeMapping(mapping) {
        const queryString = typeof mapping.query === "string"
            ? mapping.query
            : mapping.query.loc?.source.body;
        if (!queryString) {
            this.connection.reportAndThrow(new Error("Unexpected parsed query without body"));
        }
        const result = await this.connection.request(queryString, mapping.variables);
        const parsed = mapping.parseResult(result);
        if (!this.rawResource.makeSubproperties) {
            if (parsed instanceof Array) {
                return parsed.map((p) => deflateParams(p));
            }
            else {
                return deflateParams(parsed);
            }
        }
        return parsed;
    }
    mapFilter(filter) {
        return filter.reduce((mapped, element) => {
            const from = typeof element.value == "string"
                ? element.value
                : element.value.from;
            const to = typeof element.value == "string" ? from : element.value.to;
            const matchOperation = element.property.type() === "string" ? "MATCH" : "EQ";
            let graphQLType = this.rawResource.typeMap?.get(element.path);
            if (graphQLType instanceof GraphQLObjectType) {
                graphQLType = GraphQLID;
            }
            if (!graphQLType || !isInputType(graphQLType)) {
                this.connection.reportAndThrow(new Error(`Cannot get valid GraphQL type from ${this.rawResource.id}:${element.path}`));
            }
            const coercedFrom = convertValue(from, graphQLType);
            const coercedTo = convertValue(to, graphQLType);
            if (from === to) {
                mapped.push({
                    field: element.property.path(),
                    is: matchOperation,
                    to: coercedFrom,
                });
            }
            else {
                if (from !== undefined && from != "") {
                    mapped.push({
                        field: element.property.path(),
                        is: "GTE",
                        to: coercedFrom,
                    });
                }
                if (to !== undefined && to != "") {
                    mapped.push({
                        field: element.property.path(),
                        is: "LTE",
                        to: coercedTo,
                    });
                }
            }
            return mapped;
        }, []);
    }
}
function inflateParams(params) {
    const record = {};
    for (const path of Object.keys(params)) {
        const steps = path.split(".");
        let object = record;
        let index = -1;
        while (steps.length > 1) {
            const step = steps.shift();
            let nextObject = {};
            if (step === undefined) {
                break;
            }
            index = parseInt(steps[0]);
            if (!isNaN(index)) {
                nextObject = [];
            }
            object[step] = object[step] || nextObject;
            object = object[step];
        }
        if (object instanceof Array) {
            object.length = index + 1;
            object[index] = params[path];
        }
        else {
            object[steps[0]] = params[path];
        }
    }
    return record;
}
function deflateParams(params, IDField = "ID") {
    if (typeof params !== "object" || params == null) {
        return params;
    }
    const typed = params;
    const record = {};
    for (const key of Object.keys(typed)) {
        let param = typed[key];
        if (typeof param === "object" && param !== null) {
            const deflated = deflateParams(param);
            const deflatedKeys = Object.keys(deflated);
            if (deflatedKeys.length === 1 && IDField in deflated) {
                // Reference hack!
                param = Object.values(deflated)[0];
                record[key] = param;
            }
            else {
                for (const subKey of deflatedKeys) {
                    record[`${key}.${subKey}`] = deflated[subKey];
                }
            }
        }
        else {
            record[key] = param;
        }
    }
    return record;
}
function deflateReference(ref) {
    if (typeof ref === "object" && ref !== null) {
        const fields = Object.values(ref);
        if (fields.length === 1) {
            return fields[0];
        }
    }
    return `${ref}`;
}
function convertValue(value, type) {
    if (type instanceof GraphQLScalarType) {
        return type.serialize(value);
    }
    return value;
}
export const _testing = {
    inflateParams,
    deflateParams,
};
//# sourceMappingURL=GraphQLResource.js.map