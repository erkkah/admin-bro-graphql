import { PropertyType, BaseProperty } from "adminjs";
interface BasePropertyAttrs {
    path: string;
    type?: PropertyType;
    isId?: boolean;
    isSortable?: boolean;
    position?: number;
}
export declare class GraphQLPropertyAdapter extends BaseProperty {
    private _subProperties;
    private _referencing?;
    private _enumValues?;
    private _isArray?;
    private _isRequired?;
    constructor(property: BasePropertyAttrs & {
        referencing?: string;
        enumValues?: string[];
        isArray?: boolean;
        isRequired?: boolean;
    });
    setSubProperties(properties: BaseProperty[]): void;
    subProperties(): BaseProperty[];
    reference(): string | null;
    availableValues(): string[] | null;
    isArray(): boolean;
    isRequired(): boolean;
}
export {};
//# sourceMappingURL=GraphQLProperty.d.ts.map