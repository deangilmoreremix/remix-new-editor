/**
 * Ported from CineGen: src/types/workflow.ts
 * Original: https://github.com/deangilmoreremix/CineGen/blob/main/src/types/workflow.ts
 */

/** @typedef {'text'|'image'|'video'|'audio'|'media'|'number'|'config'|'model'|'multi_prompt'|'composition_plan'} PortType */
/** @typedef {'utility'|'image'|'video'|'image-edit'|'audio'|'text'} NodeCategory */
/** @typedef {'prompt'|'duration'|'assetOutput'|'multiPrompt'|'shotPrompt'|'element'|'compositionPlan'|'musicPrompt'|'filePicker'} UtilityNodeType */
/** @typedef {UtilityNodeType | string} CinegenNodeType */

/**
 * @typedef {Object} PortDefinition
 * @property {string} id
 * @property {PortType} type
 * @property {string} label
 */

/**
 * @typedef {Object} NodeTypeDefinition
 * @property {CinegenNodeType} type
 * @property {string} label
 * @property {NodeCategory} category
 * @property {PortDefinition[]} inputs
 * @property {PortDefinition[]} outputs
 * @property {Record<string, unknown>} defaultData
 * @property {boolean} [isModel]
 */

/**
 * @typedef {Object} ModelInputField
 * @property {string} id
 * @property {PortType} portType
 * @property {string} label
 * @property {boolean} required
 * @property {string} falParam
 * @property {'port'|'text'|'textarea'|'number'|'select'|'range'|'toggle'|'element-list'} fieldType
 * @property {{value:string,label:string}[]} [options]
 * @property {unknown} [default]
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 */

/**
 * @typedef {Object} ModelDefinition
 * @property {string} id
 * @property {string} [altId]
 * @property {string} nodeType
 * @property {string} name
 * @property {NodeCategory} category
 * @property {string} description
 * @property {ModelInputField[]} inputs
 * @property {PortType} outputType
 * @property {string} [provider]
 * @property {string} [runpodEndpointId]
 * @property {string} [podRoute]
 * @property {{path:string}} responseMapping
 */

/**
 * @typedef {Object} LayerInfo
 * @property {string} url
 * @property {string} name
 * @property {string} type
 * @property {number} z_order
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} TranscriptWord
 * @property {number} start
 * @property {number} end
 * @property {string} text
 * @property {string|null} [speaker]
 * @property {TranscriptWord[]} [words]
 */

/**
 * @typedef {Object} TranscriptSegment
 * @property {number} start
 * @property {number} end
 * @property {string} text
 * @property {string|null} [speaker]
 * @property {TranscriptWord[]} [words]
 */

/**
 * @typedef {Object} WorkflowNodeData
 * @property {CinegenNodeType} type
 * @property {string} label
 * @property {Record<string, unknown>} config
 * @property {string} [modelId]
 * @property {Object} [result]
 * @property {string[]} [generations]
 * @property {number} [activeGeneration]
 */

/**
 * @typedef {Object} WorkflowRun
 * @property {string} id
 * @property {string} status
 * @property {string} startedAt
 * @property {string} [completedAt]
 * @property {Record<string, {status:string, output?:unknown, error?:string}>} nodeResults
 */
