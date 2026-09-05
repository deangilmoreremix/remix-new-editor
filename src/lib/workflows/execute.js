/**
 * Workflow execution engine.
 *
 * Ported from CineGen: src/lib/workflows/execute.ts
 * Simplified for the remix-new-editor environment:
 * - Uses muapi instead of window.electronAPI.workflow.run
 * - No local Python runner support
 * - No Electron-specific APIs
 */

import { NODE_REGISTRY } from './node-registry.js';
import { getModelDefinition, resolveVideoModelEndpoint, sanitizeVideoInputsForEndpoint } from '../fal/models.js';
import { muapi } from '../muapi.js';

// ---------------------------------------------------------------------------
// Dispatch interface
// ---------------------------------------------------------------------------

/**
 * @typedef {(nodeId: string, running: boolean) => void} SetNodeRunningFn
 * @typedef {(nodeId: string, result: Record<string, unknown>) => void} SetNodeResultFn
 * @typedef {(nodeId: string, url: string) => void} AddGenerationFn
 * @typedef {(asset: { id: string; name: string; type: 'image' | 'video'; url: string; createdAt: string }) => void} AddAssetFn
 * @typedef {() => Element[]} GetElementsFn
 */

/**
 * @typedef {Object} WorkflowDispatch
 * @property {SetNodeRunningFn} setNodeRunning
 * @property {SetNodeResultFn} setNodeResult
 * @property {AddGenerationFn} addGeneration
 * @property {AddAssetFn} addAsset
 * @property {GetElementsFn} getElements
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {string} nodeType
 * @param {string} [stage]
 * @param {string} [message]
 * @param {Partial<NonNullable<WorkflowNodeData['result']>>} [extras]
 * @returns {WorkflowNodeData['result']}
 */
function buildRunningResult(nodeType, stage, message, extras = {}) {
  return {
    ...extras,
    status: 'running',
    ...(stage && { progressStage: stage }),
    ...(message && { progressMessage: message }),
  };
}

/**
 * @param {{id: string}[]} portDefs
 * @param {Edge[]} edges
 * @param {string} nodeId
 * @param {Map<string, Record<string, unknown>>} results
 * @returns {Record<string, unknown>}
 */
function resolveInputs(portDefs, edges, nodeId, results) {
  const inputs = {};
  for (const input of portDefs) {
    const incomingEdge = edges.find((e) => e.target === nodeId && e.targetHandle === input.id);
    if (!incomingEdge) continue;
    const sourceResult = results.get(incomingEdge.source);
    if (sourceResult && incomingEdge.sourceHandle) {
      inputs[input.id] = sourceResult[incomingEdge.sourceHandle];
    }
  }
  return inputs;
}

/**
 * @param {Edge[]} edges
 * @param {string} nodeId
 * @param {Map<string, Record<string, unknown>>} results
 * @returns {Record<string, unknown>}
 */
function resolveElementListInputs(edges, nodeId, results) {
  const inputs = {};
  for (const edge of edges) {
    if (edge.target !== nodeId) continue;
    const handle = edge.targetHandle;
    if (!handle || !/_\d+$/.test(handle)) continue;
    const sourceResult = results.get(edge.source);
    if (sourceResult && edge.sourceHandle) {
      inputs[handle] = sourceResult[edge.sourceHandle];
    }
  }
  return inputs;
}

// ---------------------------------------------------------------------------
// Utility node execution
// ---------------------------------------------------------------------------

/**
 * @param {string} nodeType
 * @param {{id: string, type: string, label: string}[]} outputs
 * @param {Record<string, unknown>} data
 * @param {WorkflowDispatch} dispatch
 * @returns {Record<string, unknown>}
 */
function resolveUtilityOutputs(nodeType, outputs, data, dispatch) {
  const output = {};
  for (const port of outputs) {
    switch (nodeType) {
      case 'prompt':
        output[port.id] = data.config.prompt;
        break;
      case 'multiPrompt':
      case 'shotPrompt':
        output[port.id] = data.config.shots;
        break;
      case 'compositionPlan':
        output[port.id] = {
          positiveGlobalStyles: data.config.positiveGlobalStyles,
          negativeGlobalStyles: data.config.negativeGlobalStyles,
          sections: data.config.sections,
        };
        break;
      case 'musicPrompt':
        output[port.id] = data.config.generatedPrompt ?? '';
        break;
      case 'filePicker': {
        const fileUrl = data.config.fileUrl;
        if (fileUrl) {
          output['media'] = fileUrl;
        }
        break;
      }
      case 'element': {
        const elementId = data.config.elementId;
        if (elementId) {
          const elements = dispatch.getElements();
          const el = elements.find((e) => e.id === elementId);
          if (el && el.images.length > 0) {
            const refIndices = [1, 5, 6];
            output[port.id] = {
              frontalImageUrl: el.images[0].url,
              referenceImageUrls: refIndices
                .filter((idx) => idx < el.images.length)
                .map((idx) => el.images[idx].url),
              allUrls: el.images.map((img) => img.url),
              name: el.name,
            };
          }
        }
        break;
      }
    }
  }
  return output;
}

// ---------------------------------------------------------------------------
// Model execution
// ---------------------------------------------------------------------------

/**
 * @param {string} nodeId
 * @param {string} nodeType
 * @param {Record<string, unknown>} data
 * @param {Record<string, unknown>} portInputs
 * @param {Map<string, Record<string, unknown>>} results
 * @param {WorkflowDispatch} dispatch
 */
async function executeModelNode(nodeId, nodeType, data, portInputs, results, dispatch) {
  const modelDef = getModelDefinition(nodeType);
  if (!modelDef) {
    dispatch.setNodeResult(nodeId, { status: 'error', error: `Unknown model: ${nodeType}` });
    return;
  }

  dispatch.setNodeRunning(nodeId, true);

  // SAM 3 tools are interactive-only
  if (
    modelDef.nodeType === 'sam3-segment'
    || modelDef.nodeType === 'sam3-segment-cloud'
    || modelDef.nodeType === 'sam3-track-cloud'
  ) {
    if (data.result?.url || data.result?.layers) {
      const existingUrl = data.result.url;
      if (existingUrl) {
        results.set(nodeId, { [modelDef.outputType]: existingUrl });
      }
    } else {
      dispatch.setNodeResult(nodeId, {
        status: 'error',
        error: modelDef.nodeType === 'sam3-track-cloud'
          ? 'Open the Track modal to create a segmentation.'
          : 'Open the Segment modal to create a selection.',
      });
    }
    dispatch.setNodeRunning(nodeId, false);
    return;
  }

  dispatch.setNodeResult(nodeId, buildRunningResult(nodeType));

  try {
    const falInputs = {};

    // Collect element-list data
    const elementListData = new Map();
    for (const field of modelDef.inputs) {
      if (field.fieldType !== 'element-list') continue;
      const items = [];
      for (const [key, value] of Object.entries(portInputs)) {
        if (key.startsWith(field.id + '_') && value && typeof value === 'object') {
          items.push(value);
        }
      }
      if (items.length > 0) {
        elementListData.set(field.id, items);
      }
    }

    // Map element-list data to fal params
    for (const field of modelDef.inputs) {
      if (field.fieldType !== 'element-list') continue;
      const items = elementListData.get(field.id);
      if (!items || items.length === 0) continue;

      if (field.falParam === 'elements') {
        falInputs[field.falParam] = items.map((el) => ({
          frontal_image_url: el.frontalImageUrl,
          reference_image_urls: el.referenceImageUrls.slice(0, 3),
        }));
      } else if (field.falParam === 'kling_elements') {
        falInputs[field.falParam] = items.map((el) => ({
          name: el.name.replace(/\s+/g, '_').toLowerCase(),
          description: el.name,
          element_input_urls: [el.frontalImageUrl, ...el.referenceImageUrls].slice(0, 4),
        }));
      } else if (field.falParam === 'image_input' || field.falParam === 'image_urls' || field.falParam.startsWith('image_url')) {
        const existing = Array.isArray(falInputs[field.falParam]) ? falInputs[field.falParam] : [];
        falInputs[field.falParam] = [...existing, ...items.flatMap((el) => el.allUrls)];
      } else if (field.falParam === 'video_urls' || field.falParam === 'audio_urls') {
        const existing = Array.isArray(falInputs[field.falParam]) ? falInputs[field.falParam] : [];
        falInputs[field.falParam] = [...existing, ...items.map((el) => el.frontalImageUrl)];
      } else {
        falInputs[field.falParam] = items.map((el) => el.frontalImageUrl);
      }
    }

    // Map standard port inputs
    for (const field of modelDef.inputs) {
      if (field.fieldType === 'element-list') continue;
      if (field.id === 'last_frame') continue;

      const portValue = portInputs[field.id];
      const configValue = data.config[field.id];
      const value = portValue ?? configValue ?? field.default;

      if (value === undefined || value === null) continue;
      if (field.id === 'seed' && value === -1) continue;

      // Handle ElementData objects from element connections
      const isElementData = typeof value === 'object' && value !== null && !Array.isArray(value)
        && ('allUrls' in value || 'frontalImageUrl' in value);

      const needsArrayParam = [
        field.falParam.endsWith('s') && field.falParam.startsWith('image_url'),
        field.falParam === 'filesUrl',
        field.falParam === 'imageUrls',
        field.falParam === 'image_input',
        field.falParam === 'urls',
        field.falParam === 'video_urls',
        field.falParam === 'audio_urls',
      ].some(Boolean);

      if (isElementData && needsArrayParam) {
        const urls = (value.allUrls ?? [value.frontalImageUrl].filter(Boolean));
        const existing = Array.isArray(falInputs[field.falParam]) ? falInputs[field.falParam] : [];
        falInputs[field.falParam] = [...existing, ...urls];
      } else if (isElementData) {
        falInputs[field.falParam] = value.frontalImageUrl ?? value.allUrls?.[0];
      } else if (typeof value === 'string' && needsArrayParam) {
        falInputs[field.falParam] = [value];
      } else if (field.portType === 'number' && field.fieldType === 'select' && typeof value === 'string') {
        const numeric = Number(value);
        falInputs[field.falParam] = Number.isFinite(numeric) && value.trim() !== '' ? numeric : value;
      } else {
        falInputs[field.falParam] = value;
      }
    }

    // Resolve element mentions in prompts
    const connectedElements = [];
    for (const items of elementListData.values()) {
      connectedElements.push(...items);
    }

    if (falInputs.multi_prompt && Array.isArray(falInputs.multi_prompt)) {
      const isKie = modelDef.provider === 'kie';
      falInputs.multi_prompt = falInputs.multi_prompt.map((shot) => ({
        prompt: resolveElementMentions(shot.prompt, connectedElements, isKie),
        duration: isKie ? Number(shot.duration) : String(shot.duration),
      }));
      delete falInputs.prompt;
      delete falInputs.duration;
      if (isKie) {
        falInputs.multi_shots = true;
      } else if (!falInputs.shot_type) {
        falInputs.shot_type = 'customize';
      }
    }

    if (typeof falInputs.prompt === 'string' && connectedElements.length > 0) {
      falInputs.prompt = resolveElementMentions(falInputs.prompt, connectedElements, modelDef.provider === 'kie');
    }

    // Determine effective model ID
    const hasImageInputs = modelDef.inputs.some(
      (f) => (f.portType === 'image' && (f.fieldType === 'port' || f.fieldType === 'element-list'))
        && (portInputs[f.id] || Object.keys(portInputs).some((k) => k.startsWith(f.id + '_'))),
    );
    const qualityTier = String(falInputs.quality ?? data.config.quality ?? 'pro');
    let effectiveModelId = resolveVideoModelEndpoint(modelDef.nodeType, modelDef, {
      hasImageInputs,
      quality: qualityTier,
    });

    // Route image/video nodes through muapi using the correct model identifier.
    // CineGen's fal/kie registry uses IDs like `fal-ai/flux/dev`, but muapi
    // expects its own short names like `flux-dev`. When a model definition
    // carries `provider: 'muapi'` we swap in the muapi model ID here while
    // keeping all the CineGen UI metadata (inputs, defaults, etc.).
    if (modelDef.provider === 'muapi' && modelDef.muapiModelId) {
      effectiveModelId = modelDef.muapiModelId;
    }

    // Sanitize inputs for specific endpoints
    if (modelDef.nodeType === 'sora-2' || modelDef.nodeType === 'ltx-2-3-text' || modelDef.nodeType === 'ltx-2-3-image') {
      sanitizeVideoInputsForEndpoint(modelDef.nodeType, effectiveModelId, falInputs);
    }

    if (modelDef.nodeType === 'flux-kontext') {
      if (hasImageInputs) {
        delete falInputs.image_size;
      } else {
        delete falInputs.strength;
      }
    }

    if (modelDef.nodeType === 'seedance-2' && effectiveModelId === modelDef.id) {
      delete falInputs.image_url;
      delete falInputs.end_image_url;
    }

    if (modelDef.nodeType === 'ltx-2-video' && effectiveModelId === modelDef.id) {
      delete falInputs.image_url;
    }

    if (typeof falInputs.music_length_ms === 'string') {
      falInputs.music_length_ms = Number(falInputs.music_length_ms);
    }

    // Build clean API inputs
    const apiInputs = { ...falInputs };
    for (const key of Object.keys(apiInputs)) {
      if (key.startsWith('_')) delete apiInputs[key];
    }
    if (modelDef.nodeType !== 'layer-decompose') {
      delete apiInputs.reconstruct_bg;
    }
    sanitizeVideoInputsForEndpoint(modelDef.nodeType, effectiveModelId, apiInputs);
    for (const emptyKey of ['language_code', 'source_lang', 'language']) {
      if (apiInputs[emptyKey] === '') delete apiInputs[emptyKey];
    }

    console.log('[workflow] Sending to model:', effectiveModelId, JSON.stringify(falInputs, null, 2));

    // Call the appropriate muapi method based on output type
    let result;
    const commonParams = {
      model: effectiveModelId,
      prompt: apiInputs.prompt ?? '',
    };

    switch (modelDef.outputType) {
      case 'image':
        result = await muapi.generateImage({
          ...commonParams,
          aspect_ratio: apiInputs.aspect_ratio,
          resolution: apiInputs.resolution,
          quality: apiInputs.quality,
          image_url: apiInputs.image_url,
          strength: apiInputs.strength,
          seed: apiInputs.seed,
          negative_prompt: apiInputs.negative_prompt,
        });
        break;
      case 'video':
        result = await muapi.generateVideo({
          ...commonParams,
          duration: apiInputs.duration,
          aspect_ratio: apiInputs.aspect_ratio,
          resolution: apiInputs.resolution,
          image_url: apiInputs.image_url,
          end_image_url: apiInputs.end_image_url,
        });
        break;
      case 'audio':
        result = await muapi.generateAudio({
          ...commonParams,
          duration: apiInputs.duration,
        });
        break;
      case 'text': {
        // OpenRouter gateway pattern: keep the gateway endpoint
        // ('openrouter/router') and forward the user's selected LLM
        // as the payload model.
        const textModel = apiInputs.model || effectiveModelId;
        const isOpenRouter = modelDef.nodeType === 'openrouter-llm';
        result = await muapi.generateText({
          ...commonParams,
          model: textModel,
          ...(isOpenRouter ? { endpoint: 'openrouter/router' } : {}),
        });
        break;
      }
      default:
        // Fallback: try generateImage for unknown output types
        result = await muapi.generateImage({
          ...commonParams,
          aspect_ratio: apiInputs.aspect_ratio,
        });
        break;
    }

    // Extract output from result
    let url;
    let text;
    if (modelDef.outputType === 'text') {
      // Text models return text in `data`, `output`, or `text`
      text = result?.data?.output ?? result?.data?.text ?? result?.output ?? result?.text ?? '';
      if (!text) {
        throw new Error('No text output in response');
      }
      results.set(nodeId, { text });
      dispatch.setNodeResult(nodeId, { status: 'complete', text });
      dispatch.addGeneration(nodeId, text);
    } else {
      // Image/video/audio models return a URL
      url = result?.url || result?.outputs?.[0] || result?.output?.url;
      if (!url) {
        throw new Error('No output URL in response');
      }
      results.set(nodeId, { [modelDef.outputType]: url });
      dispatch.setNodeResult(nodeId, { status: 'complete', url });
      dispatch.addGeneration(nodeId, url);
    }
  } catch (error) {
    dispatch.setNodeResult(nodeId, {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    dispatch.setNodeRunning(nodeId, false);
  }
}

// ---------------------------------------------------------------------------
// Topological sort
// ---------------------------------------------------------------------------

/**
 * @param {Node<WorkflowNodeData>[]} nodes
 * @param {Edge[]} edges
 * @returns {string[]}
 */
function topologicalSort(nodes, edges) {
  const inDegree = new Map();
  const adjacency = new Map();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    adjacency.get(edge.source)?.push(edge.target);
  }

  const queue = [];
  for (const node of nodes) {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  }

  const sorted = [];
  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);
    for (const neighbor of adjacency.get(current) || []) {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @param {Node<WorkflowNodeData>[]} nodes
 * @param {Edge[]} edges
 * @param {WorkflowDispatch} dispatch
 */
export async function executeWorkflow(nodes, edges, dispatch) {
  const order = topologicalSort(nodes, edges);
  await runNodes(order, nodes, edges, dispatch);
}

/**
 * @param {string} targetNodeId
 * @param {Node<WorkflowNodeData>[]} nodes
 * @param {Edge[]} edges
 * @param {WorkflowDispatch} dispatch
 */
export async function executeFromNode(targetNodeId, nodes, edges, dispatch) {
  const upstream = getUpstreamNodes(targetNodeId, nodes, edges);
  upstream.push(targetNodeId);

  const subgraphNodes = nodes.filter((n) => upstream.includes(n.id));
  const subgraphEdges = edges.filter(
    (e) => upstream.includes(e.source) && upstream.includes(e.target),
  );

  const order = topologicalSort(subgraphNodes, subgraphEdges);
  await runNodes(order, nodes, edges, dispatch, targetNodeId);
}

/**
 * @param {string} nodeId
 * @param {Node<WorkflowNodeData>[]} nodes
 * @param {Edge[]} edges
 * @returns {string[]}
 */
function getUpstreamNodes(nodeId, nodes, edges) {
  const visited = new Set();
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const edge of edges) {
      if (edge.target === current && !visited.has(edge.source)) {
        visited.add(edge.source);
        stack.push(edge.source);
      }
    }
  }

  return Array.from(visited);
}

/**
 * @param {string[]} order
 * @param {Node<WorkflowNodeData>[]} nodes
 * @param {Edge[]} edges
 * @param {WorkflowDispatch} dispatch
 * @param {string} [targetNodeId]
 */
async function runNodes(order, nodes, edges, dispatch, targetNodeId) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const results = new Map();

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const nodeType = node.data.type;
    const definition = NODE_REGISTRY[nodeType];
    if (!definition) continue;

    const portInputs = resolveInputs(definition.inputs, edges, nodeId, results);

    if (definition.category === 'utility') {
      results.set(nodeId, resolveUtilityOutputs(nodeType, definition.outputs, node.data, dispatch));
      continue;
    }

    if (definition.isModel) {
      const existingUrl = node.data.result?.url;
      if (targetNodeId && nodeId !== targetNodeId && existingUrl) {
        const modelDef = getModelDefinition(nodeType);
        if (modelDef) {
          results.set(nodeId, { [modelDef.outputType]: existingUrl });
        }
        continue;
      }

      const elementListInputs = resolveElementListInputs(edges, nodeId, results);
      await executeModelNode(nodeId, nodeType, node.data, { ...portInputs, ...elementListInputs }, results, dispatch);
    }
  }
}

// ---------------------------------------------------------------------------
// Element mention resolution
// ---------------------------------------------------------------------------

/**
 * @param {string} prompt
 * @param {Array<{name: string}>} elements
 * @param {boolean} [useKieFormat=false]
 * @returns {string}
 */
function resolveElementMentions(prompt, elements, useKieFormat = false) {
  let resolved = prompt;
  for (let i = 0; i < elements.length; i++) {
    const name = elements[i].name;
    const replacement = useKieFormat
      ? `@${name.replace(/\s+/g, '_').toLowerCase()}`
      : `@Element${i + 1}`;
    resolved = resolved.replace(
      new RegExp(`@${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
      replacement,
    );
  }
  return resolved;
}
