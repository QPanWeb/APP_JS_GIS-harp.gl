/*
 * Copyright (C) 2017-2020 HERE Europe B.V.
 * Licensed under Apache 2.0, see full license in LICENSE
 * SPDX-License-Identifier: Apache-2.0
 */
import { GeometryKind, GeometryKindSet } from "@here/harp-datasource-protocol";
import { MapEnv } from "@here/harp-datasource-protocol/index-decoder";
import {
    FeatureFilterDescription,
    FilterDescription,
    FilterFeatureAttribute,
    FilterString,
    GeometryType,
    LayerFilterDescription
} from "./OmvDecoderDefs";

/**
 * The `OmvFeatureFilter` is designed to work in an `OmvVisitor`/`visitOmv` combination (for
 * example, `OmvDecoder`).
 *
 * @remarks
 * Returning `false` from any of the calls terminates processing of that
 * layer or feature.
 *
 * The `OmvFeatureFilter` is an "early-opt-out" filter, which cannot filter individual features,
 * because at that point the features are not really decoded. Use the [[OmvFeatureModifier]] to
 * filter for individual features.
 */
export interface FeatureFilter {
    /**
     * Returns `true` if the filter contains rules for specific kinds.
     */
    hasKindFilter: boolean;

    /**
     * Return `false` if the layer should not be processed.
     *
     * @param layer - Current layer.
     * @param level - Level of tile.
     */
    wantsLayer(layer: string, level: number): boolean;

    /**
     * Return `false` if the point feature should not be processed.
     *
     * @param layer - Current layer.
     * @param feature - Current feature.
     * @param level - Level of tile.
     */
    wantsPointFeature(layer: string, geometryType: GeometryType, level: number): boolean;

    /**
     * Return `false` if the line feature should not be processed.
     *
     * @param layer - Current layer.
     * @param feature - Current feature.
     * @param level - Level of tile.
     */
    wantsLineFeature(layer: string, geometryType: GeometryType, level: number): boolean;

    /**
     * Return `false` if the polygon feature should not be processed.
     *
     * @param layer - Current layer.
     * @param feature - Current feature.
     * @param level - Level of tile.
     */
    wantsPolygonFeature(layer: string, geometryType: GeometryType, level: number): boolean;

    /**
     * Return `false` if kind of object is not enabled and the geometry should not be created.
     *
     * @param {(string | string[])} kind Tag "kind" of the tag.
     * @returns {boolean}
     */
    wantsKind(kind: string | string[]): boolean;
}

/**
 * The `OmvFeatureModifier` can be used to filter individual features.
 *
 * @remarks
 * It gets passed in the `Env`
 * of the feature, which contains all the values that can be searched for in a style. If a filter
 * function returns false, the feature is ignored, and no geometry is being created.
 *
 * In addition to pure filtering, the `OmvFeatureModifier` can also modify the [[Env]] of the
 * feature, or even add new properties to the feature, for example, traffic states. The
 * `OmvFeatureModifier` is executed before the styles are selected, so the geometry is created with
 * the modified feature properties.
 */
export interface FeatureModifier {
    /**
     * Check if the point feature described by `env` should be processed. The properties can be
     * modified or added to.
     *
     * @param layer - Current layer.
     * @param env - Properties of point feature.
     * @param level - Level of tile.
     * @returns `false` to ignore feature.
     */
    doProcessPointFeature(layer: string, env: MapEnv, level: number): boolean;

    /**
     * Check if the line feature described by `env` should be processed. The properties can be
     * modified or added to.
     *
     * @param layer - Current layer.
     * @param env - Properties of line feature.
     * @param level - Level of tile.
     * @returns `false` to ignore feature.
     */
    doProcessLineFeature(layer: string, env: MapEnv, level: number): boolean;

    /**
     * Check if the polygon feature described by `env` should be processed. The properties can be
     * modified or added to.
     *
     * @param layer - Current layer.
     * @param env - Properties of polygon feature.
     * @param level - Level of tile.
     * @returns `false` to ignore feature.
     */
    doProcessPolygonFeature(layer: string, env: MapEnv, level: number): boolean;
}

/**
 * Builds an `OmvFilterDescription` (internal type) that specifies an [[OmvFeatureFilter]] as well
 * as an [[OmvFeatureModifier]].
 *
 */
export class FeatureFilterDescriptionBuilder {
    private readonly m_processLayersDefault: boolean = true;
    private readonly m_processPointsDefault: boolean = true;
    private readonly m_processLinesDefault: boolean = true;
    private readonly m_processPolygonsDefault: boolean = true;

    private readonly m_layersToProcess = new Array<LayerFilterDescription>();
    private readonly m_layersToIgnore = new Array<LayerFilterDescription>();
    private readonly m_pointsToProcess = new Array<FilterDescription>();
    private readonly m_ignoredPoints = new Array<FilterDescription>();
    private readonly m_linesToProcess = new Array<FilterDescription>();
    private readonly m_linesToIgnore = new Array<FilterDescription>();
    private readonly m_polygonsToProcess = new Array<FilterDescription>();
    private readonly m_polygonsToIgnore = new Array<FilterDescription>();

    private m_kindsToProcess: string[] = [];
    private m_kindsToIgnore: string[] = [];

    /**
     * Builds an `OmvFilterDescription` (internal type) that specifies an [[OmvFeatureFilter]] as
     * well as an [[OmvFeatureModifier]].
     *
     * @param processLayersDefault - If `true`, all unspecified layers will be processed.
     * If `false`, all unspecified layers will be ignored.
     * @param processPointsDefault - If `true`, all unspecified point features will be processed. If
     * `false`, all unspecified point features will be ignored.
     * @param processLinesDefault - If `true`, all unspecified line features will be processed. If
     * `false`, all unspecified line features will be ignored.
     * @param processPolygonsDefault - If `true`, all unspecified polygon features will be
     * processed. If `false`, all unspecified polygon features will be ignored.
     */
    constructor(options?: FeatureFilterDescriptionBuilder.FeatureFilterDescriptionBuilderOptions) {
        if (options) {
            this.m_processLayersDefault =
                options.processLayersDefault !== undefined ? options.processLayersDefault : true;
            this.m_processPointsDefault =
                options.processPointsDefault !== undefined ? options.processPointsDefault : true;
            this.m_processLinesDefault =
                options.processLinesDefault !== undefined ? options.processLinesDefault : true;
            this.m_processPolygonsDefault =
                options.processPolygonsDefault !== undefined
                    ? options.processPolygonsDefault
                    : true;
        }
    }

    /**
     * Add a layer that should be processed.
     *
     * @param layer - Layer name to be matched.
     * @param match - Match condition.
     */
    processLayer(
        layer: string,
        match = FilterString.StringMatch.Match,
        minLevel: number = 0,
        maxLevel: number = Infinity
    ) {
        this.m_layersToProcess.push({
            name: { value: layer, match },
            minLevel,
            maxLevel
        });
    }

    /**
     * Add a layer that should be ignored.
     *
     * @param layer - Layer name to be matched.
     * @param match - Match condition.
     */
    ignoreLayer(
        layer: string,
        match = FilterString.StringMatch.Match,
        minLevel: number = 0,
        maxLevel: number = Infinity
    ) {
        this.m_layersToIgnore.push({
            name: { value: layer, match },
            minLevel,
            maxLevel
        });
    }

    /**
     * Add a valid point feature.
     *
     * @param options - Feature options.
     */
    processPoint(options: FeatureFilterDescriptionBuilder.FeatureOption) {
        this.addItem(this.m_pointsToProcess, options);
    }

    /**
     * Add valid point features.
     *
     * @param options - Multi feature options.
     */
    processPoints(options: FeatureFilterDescriptionBuilder.MultiFeatureOption) {
        this.addItems(this.m_pointsToProcess, options);
    }

    /**
     * Add a point feature that should be ignored.
     *
     * @param options - Feature options.
     */
    ignorePoint(options: FeatureFilterDescriptionBuilder.FeatureOption) {
        this.addItem(this.m_ignoredPoints, options);
    }

    /**
     * Add point features that should be ignored.
     *
     * @param options - Multi feature options.
     */
    ignorePoints(options: FeatureFilterDescriptionBuilder.MultiFeatureOption) {
        this.addItems(this.m_ignoredPoints, options);
    }

    /**
     * Add a valid line feature.
     *
     * @param options - Feature options.
     */
    processLine(options: FeatureFilterDescriptionBuilder.FeatureOption) {
        this.addItem(this.m_linesToProcess, options);
    }

    /**
     * Add valid line features.
     *
     * @param options - Multi feature options.
     */
    processLines(options: FeatureFilterDescriptionBuilder.MultiFeatureOption) {
        this.addItems(this.m_linesToProcess, options);
    }

    /**
     * Ignore a line feature.
     *
     * @param options - Feature options.
     */
    ignoreLine(options: FeatureFilterDescriptionBuilder.FeatureOption) {
        this.addItem(this.m_linesToIgnore, options);
    }

    /**
     * Ignore line features.
     *
     * @param options - Multi feature options.
     */
    ignoreLines(options: FeatureFilterDescriptionBuilder.MultiFeatureOption) {
        this.addItems(this.m_linesToIgnore, options);
    }

    /**
     * Add a valid polygon feature.
     *
     * @param options - Feature options.
     */
    processPolygon(options: FeatureFilterDescriptionBuilder.FeatureOption) {
        this.addItem(this.m_polygonsToProcess, options);
    }

    /**
     * Add valid polygon features.
     *
     * @param options - Multi feature options.
     */
    processPolygons(options: FeatureFilterDescriptionBuilder.MultiFeatureOption) {
        this.addItems(this.m_polygonsToProcess, options);
    }

    /**
     * Ignore a valid polygon feature.
     *
     * @param options - Feature options.
     */
    ignorePolygon(options: FeatureFilterDescriptionBuilder.FeatureOption) {
        this.addItem(this.m_polygonsToIgnore, options);
    }

    /**
     * Ignore polygon features.
     *
     * @param options - Multi feature options.
     */
    ignorePolygons(options: FeatureFilterDescriptionBuilder.MultiFeatureOption) {
        this.addItems(this.m_polygonsToIgnore, options);
    }

    /**
     * Add all the specified strings as "enabledKinds".
     *
     * @param {string[]} enabledKinds List of kinds that should be generated.
     */
    processKinds(enabledKinds: string[]) {
        this.m_kindsToProcess = this.m_kindsToProcess.concat(enabledKinds);
    }

    /**
     * Add all the specified strings as "disabledKinds".
     *
     * @param {string[]} disabledKinds List of kinds that should _not_ be generated.
     */
    ignoreKinds(disabledKinds: string[]) {
        this.m_kindsToIgnore = this.m_kindsToIgnore.concat(disabledKinds);
    }

    /**
     * Create a filter description that can be passed as an option to the [[OmvDataSource]].
     */
    createDescription(): FeatureFilterDescription {
        return {
            processLayersDefault: this.m_processLayersDefault,
            processPointsDefault: this.m_processPointsDefault,
            processLinesDefault: this.m_processLinesDefault,
            processPolygonsDefault: this.m_processPolygonsDefault,

            layersToProcess: this.m_layersToProcess,
            layersToIgnore: this.m_layersToIgnore,
            pointsToProcess: this.m_pointsToProcess,
            pointsToIgnore: this.m_ignoredPoints,
            linesToProcess: this.m_linesToProcess,
            linesToIgnore: this.m_linesToIgnore,
            polygonsToProcess: this.m_polygonsToProcess,
            polygonsToIgnore: this.m_polygonsToIgnore,

            kindsToProcess: this.m_kindsToProcess,
            kindsToIgnore: this.m_kindsToIgnore
        };
    }

    private addItem(
        items: FilterDescription[],
        options: FeatureFilterDescriptionBuilder.FeatureOption
    ) {
        if (options.minLevel === undefined || isNaN(options.minLevel)) {
            options.minLevel = 0;
        }
        if (options.maxLevel === undefined || isNaN(options.maxLevel)) {
            options.maxLevel = Infinity;
        }

        const item: FilterDescription = {
            layerName: {
                value: options.layer,
                match:
                    options.matchLayer === undefined
                        ? FilterString.StringMatch.Match
                        : options.matchLayer
            },
            geometryTypes:
                options.geomType !== undefined
                    ? Array.isArray(options.geomType)
                        ? options.geomType
                        : [options.geomType]
                    : undefined,
            classes: [
                {
                    value: options.featureClass,
                    match:
                        options.matchClass === undefined
                            ? FilterString.StringMatch.Match
                            : options.matchClass
                }
            ],
            minLevel: options.minLevel,
            maxLevel: options.maxLevel,
            featureAttribute: options.featureAttribute
        };

        items.push(item);
    }

    private addItems(
        items: FilterDescription[],
        options: FeatureFilterDescriptionBuilder.MultiFeatureOption
    ) {
        if (options.minLevel === undefined || isNaN(options.minLevel)) {
            options.minLevel = 0;
        }
        if (options.maxLevel === undefined || isNaN(options.maxLevel)) {
            options.maxLevel = Infinity;
        }

        const item: FilterDescription = {
            layerName: {
                value: options.layer,
                match:
                    options.matchLayer === undefined
                        ? FilterString.StringMatch.Match
                        : options.matchLayer
            },
            geometryTypes:
                options.geomTypes !== undefined
                    ? Array.isArray(options.geomTypes)
                        ? options.geomTypes
                        : [options.geomTypes]
                    : undefined,
            classes: options.featureClasses,
            minLevel: options.minLevel,
            maxLevel: options.maxLevel,
            featureAttribute: options.featureAttribute
        };

        items.push(item);
    }
}

export namespace FeatureFilterDescriptionBuilder {
    /**
     * Options for `FeatureFilterDescriptionBuilder`.
     */
    export interface FeatureFilterDescriptionBuilderOptions {
        /**
         * If `true`, all unspecified layers will be processed. If `false`, all unspecified layers
         * will be ignored.
         */
        processLayersDefault?: boolean;
        /**
         * If `true`, all unspecified point features will be processed. If `false`, all unspecified
         * point features will be ignored.
         */
        processPointsDefault?: boolean;
        /**
         * If `true`, all unspecified line features will be processed. If `false`, all unspecified
         * line
         * features will be ignored.
         */
        processLinesDefault?: boolean;
        /**
         * If `true`, all unspecified polygon features will be processed. If `false`, all
         * unspecified polygon features will be ignored.
         */
        processPolygonsDefault?: boolean;
    }

    /**
     * Description of a single feature.
     */
    export interface FeatureOption {
        /**
         * Layer name to be matched.
         */
        layer: string;
        /**
         * Optional geometry type to be limited to. If specified, but does not match, the feature is
         * ignored.
         */
        geomType: GeometryType | GeometryType[] | undefined;
        /**
         * Optional class to match. If specified, but does not match, the feature is ignored.
         */
        featureClass: string;
        /**
         * Match condition for the layer name.
         */
        matchLayer?: FilterString.StringMatch;
        /**
         * Match condition for `featureClass`.
         */
        matchClass?: FilterString.StringMatch;
        /**
         * Minimum tile level to match.
         */
        minLevel?: number;
        /**
         * Maximum tile level to match.
         */
        maxLevel?: number;
        /**
         * Feature attribute to match.
         */
        featureAttribute?: FilterFeatureAttribute;
    }

    /**
     * Description for multiple features.
     */
    export interface MultiFeatureOption {
        /**
         * Layer name to be matched.
         */
        layer: string;
        /**
         * Optional geometry type to be limited to. If specified, but does not match, the feature is
         * ignored.
         */
        geomTypes?: GeometryType | GeometryType[] | undefined;
        /**
         * Optional classes to match. If specified, but does not match, the feature is ignored.
         */
        featureClasses?: FilterString[];
        /**
         * Match condition for the layer name.
         */
        matchLayer?: FilterString.StringMatch;
        /**
         * Minimum tile level to match.
         */
        minLevel?: number;
        /**
         * Maximum tile level to match.
         */
        maxLevel?: number;
        /**
         * Feature attribute to match.
         */
        featureAttribute?: FilterFeatureAttribute;
    }
}

/**
 * `OmvFeatureFilter` implementation that uses a `FeatureFilterDescription` to filter `TileData`
 * features before they are completely decoded.
 *
 * @internal
 */
export class GenericFeatureFilter implements FeatureFilter {
    private static matchLayer(
        layer: string,
        layerItems: LayerFilterDescription[],
        level: number
    ): boolean {
        for (const layerItem of layerItems) {
            if (level < layerItem.minLevel || level > layerItem.maxLevel) {
                continue;
            }

            if (FilterString.matchString(layer, layerItem.name)) {
                return true;
            }
        }
        return false;
    }

    private readonly disabledKinds: GeometryKindSet | undefined;
    private readonly enabledKinds: GeometryKindSet | undefined;

    constructor(private readonly description: FeatureFilterDescription) {
        if (this.description.kindsToProcess.length > 0) {
            this.enabledKinds = new GeometryKindSet(
                this.description.kindsToProcess as GeometryKind[]
            );
        }
        if (this.description.kindsToIgnore.length > 0) {
            this.disabledKinds = new GeometryKindSet(
                this.description.kindsToIgnore as GeometryKind[]
            );
        }
    }

    wantsLayer(layer: string, level: number): boolean {
        if (GenericFeatureFilter.matchLayer(layer, this.description.layersToProcess, level)) {
            return true;
        }

        if (GenericFeatureFilter.matchLayer(layer, this.description.layersToIgnore, level)) {
            return false;
        }

        return this.description.processLayersDefault;
    }

    wantsPointFeature(layer: string, geometryType: GeometryType, level: number): boolean {
        return this.wantsFeature(
            this.description.pointsToProcess,
            this.description.pointsToIgnore,
            layer,
            geometryType,
            level,
            this.description.processPointsDefault
        );
    }

    wantsLineFeature(layer: string, geometryType: GeometryType, level: number): boolean {
        return this.wantsFeature(
            this.description.linesToProcess,
            this.description.linesToIgnore,
            layer,
            geometryType,
            level,
            this.description.processLinesDefault
        );
    }

    wantsPolygonFeature(layer: string, geometryType: GeometryType, level: number): boolean {
        return this.wantsFeature(
            this.description.polygonsToProcess,
            this.description.polygonsToIgnore,
            layer,
            geometryType,
            level,
            this.description.processPolygonsDefault
        );
    }

    wantsKind(kind: string | string[]): boolean {
        // undefined -> no way to filter
        if (kind === undefined) {
            return true;
        }

        return (
            !(
                this.disabledKinds !== undefined &&
                this.disabledKinds.hasOrIntersects(kind as GeometryKind)
            ) ||
            (this.enabledKinds !== undefined &&
                this.enabledKinds.hasOrIntersects(kind as GeometryKind))
        );
    }

    get hasKindFilter(): boolean {
        return this.enabledKinds !== undefined || this.disabledKinds !== undefined;
    }

    private wantsFeature(
        itemsToProcess: FilterDescription[],
        itemsToIgnore: FilterDescription[],
        layer: string,
        geometryType: GeometryType,
        level: number,
        defaultResult: boolean
    ): boolean {
        for (const item of itemsToProcess) {
            if (level < item.minLevel || level > item.maxLevel) {
                continue;
            }

            if (!FilterString.matchString(layer, item.layerName)) {
                // this rule is not for this layer
                continue;
            }

            if (item.geometryTypes !== undefined && item.geometryTypes.indexOf(geometryType) >= 0) {
                return true;
            }
        }

        for (const item of itemsToIgnore) {
            if (!FilterString.matchString(layer, item.layerName)) {
                // this rule is not for this layer
                continue;
            }

            if (item.geometryTypes !== undefined && item.geometryTypes.indexOf(geometryType) >= 0) {
                return false;
            }
        }

        return defaultResult;
    }
}

/**
 * An [[OmvFeatureFilter]] implementation that delegates all filter decision
 * returning `true` for any predicate if all delegates return `true`.
 *
 * @internal
 */
export class ComposedDataFilter implements FeatureFilter {
    constructor(readonly filters: FeatureFilter[]) {}

    get hasKindFilter() {
        return this.filters.reduce<boolean>(
            (result, filter) => result && filter.hasKindFilter,
            true
        );
    }

    wantsLayer(layer: string, level: number): boolean {
        return this.filters.reduce<boolean>(
            (result, filter) => result && filter.wantsLayer(layer, level),
            true
        );
    }
    wantsPointFeature(layer: string, geometryType: GeometryType, level: number): boolean {
        return this.filters.reduce<boolean>(
            (result, filter) => result && filter.wantsPointFeature(layer, geometryType, level),
            true
        );
    }
    wantsLineFeature(layer: string, geometryType: GeometryType, level: number): boolean {
        return this.filters.reduce<boolean>(
            (result, filter) => result && filter.wantsLineFeature(layer, geometryType, level),
            true
        );
    }
    wantsPolygonFeature(layer: string, geometryType: GeometryType, level: number): boolean {
        return this.filters.reduce<boolean>(
            (result, filter) => result && filter.wantsPolygonFeature(layer, geometryType, level),
            true
        );
    }
    wantsKind(kind: string | string[]): boolean {
        return this.filters.reduce<boolean>(
            (result, filter) => result && filter.wantsKind(kind),
            true
        );
    }
}
/**
 * `OmvFeatureModifier` implementation that uses a `FeatureFilterDescription` to filter
 * `TileData` features before they are completely decoded.
 *
 * @internal
 */
export class GenericFeatureModifier implements FeatureModifier {
    static matchItems(
        layerName: string,
        featureClass: string,
        items: FilterDescription[]
    ): boolean {
        for (const item of items) {
            if (item.classes !== undefined) {
                if (!FilterString.matchString(layerName, item.layerName)) {
                    continue;
                }
                for (const matchClass of item.classes) {
                    if (FilterString.matchString(featureClass, matchClass)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    static matchAttribute(layerName: string, env: MapEnv, items: FilterDescription[]): boolean {
        for (const item of items) {
            if (item.featureAttribute !== undefined) {
                if (
                    FilterString.matchString(layerName, item.layerName) &&
                    env.lookup(item.featureAttribute.key) === item.featureAttribute.value
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    constructor(private readonly description: FeatureFilterDescription) {}

    doProcessPointFeature(layer: string, env: MapEnv): boolean {
        return this.doProcessFeature(
            this.description.pointsToProcess,
            this.description.pointsToIgnore,
            layer,
            env,
            this.description.processPointsDefault
        );
    }

    doProcessLineFeature(layer: string, env: MapEnv): boolean {
        return this.doProcessFeature(
            this.description.linesToProcess,
            this.description.linesToIgnore,
            layer,
            env,
            this.description.processLinesDefault
        );
    }

    doProcessPolygonFeature(layer: string, env: MapEnv): boolean {
        return this.doProcessFeature(
            this.description.polygonsToProcess,
            this.description.polygonsToIgnore,
            layer,
            env,
            this.description.processPolygonsDefault
        );
    }

    protected doProcessFeature(
        itemsToProcess: FilterDescription[],
        itemsToIgnore: FilterDescription[],
        layer: string,
        env: MapEnv,
        defaultResult: boolean
    ): boolean {
        if (layer === undefined || (itemsToProcess.length === 0 && itemsToIgnore.length === 0)) {
            return defaultResult;
        }

        let featureClass: string | undefined;
        const featureClassThing = env.lookup("class");

        if (featureClassThing !== undefined && featureClassThing !== null) {
            featureClass = featureClassThing.toString();
        }

        if (
            featureClass &&
            GenericFeatureModifier.matchItems(layer, featureClass, itemsToProcess)
        ) {
            return true;
        }

        if (featureClass && GenericFeatureModifier.matchItems(layer, featureClass, itemsToIgnore)) {
            return false;
        }

        if (GenericFeatureModifier.matchAttribute(layer, env, itemsToProcess)) {
            return true;
        }

        if (GenericFeatureModifier.matchAttribute(layer, env, itemsToIgnore)) {
            return false;
        }

        return defaultResult;
    }
}