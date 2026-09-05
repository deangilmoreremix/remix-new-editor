/**
 * Ported from CineGen: src/types/workspace.ts
 * Original: https://github.com/deangilmoreremix/CineGen/blob/main/src/types/workspace.ts
 */

import { Node, Edge } from '@xyflow/react';
import { WorkflowNodeData } from './workflow.js';

/** @typedef {'elements'|'create'|'edit'|'llm'|'export'|'settings'} ProjectTab */

/**
 * @typedef {Object} WorkflowSpace
 * @property {string} id
 * @property {string} name
 * @property {string} createdAt
 * @property {Node<WorkflowNodeData>[]} nodes
 * @property {Edge[]} edges
 */

/**
 * @typedef {Object} WorkspaceState
 * @property {ProjectTab} activeTab
 * @property {Node<WorkflowNodeData>[]} nodes
 * @property {Edge[]} edges
 * @property {WorkflowSpace[]} spaces
 * @property {string} activeSpaceId
 * @property {Set<string>} openSpaceIds
 */
