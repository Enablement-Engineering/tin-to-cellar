import type { ValidateFunction } from 'ajv'
import type { ArtworkAsset, CellarLabel, CellarPackManifest } from './types'

/** Build-time standalone validators; no schema compiler is shipped to the browser. */
export declare const validateManifestSchema: ValidateFunction<CellarPackManifest>
export declare const validateAssetMapSchema: ValidateFunction
export declare const validateLabelSchema: ValidateFunction<CellarLabel>
export declare const validateAssetSchema: ValidateFunction<ArtworkAsset>
