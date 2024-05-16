import { BaseProperty } from "adminjs";
export class GraphQLPropertyAdapter extends BaseProperty {
    _subProperties = [];
    _referencing;
    _enumValues;
    _isArray;
    _isRequired;
    constructor(property) {
        super(property);
        this._referencing = property.referencing;
        this._enumValues = property.enumValues;
        this._isArray = property.isArray;
        this._isRequired = property.isRequired;
    }
    setSubProperties(properties) {
        this._subProperties = properties;
    }
    subProperties() {
        return this._subProperties;
    }
    reference() {
        return this._referencing || null;
    }
    availableValues() {
        return this._enumValues ?? super.availableValues();
    }
    isArray() {
        return this._isArray ?? false;
    }
    isRequired() {
        return this._isRequired ?? false;
    }
}
//# sourceMappingURL=GraphQLProperty.js.map