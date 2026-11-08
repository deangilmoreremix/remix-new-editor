import type { Node, Edge } from '@xyflow/react';
import type { Asset, MediaFolder } from './project';
import type { Timeline } from './timeline';
import type { ExportJob } from './export';
import type { WorkflowNodeData, WorkflowRun } from './workflow';
import type { Element, ElementFolder } from './elements';
import type { DirectorShow } from './director';
import type { ProjectSet } from './sets';
import type { ProjectProviderUsage } from '@cinegen/lib/providers/project-usage';

export type ProjectTab = 'elements' | 'create' | 'director' | 'edit' | 'llm' | 'export' | 'settings';

export interface WorkflowSpace {
  id: string;
  name: string;
  createdAt: string;
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
}

export type OverlayKind =
  | 'lead-form' | 'list-builder' | 'click-to-call'
  | 'overlay-text' | 'overlay-text-mask' | 'overlay-image' | 'overlay-personalized-image' | 'overlay-sticker' | 'overlay-background' | 'overlay-lower-third';
/** [remix] One overlay on the video: timing in seconds plus the old add-on's own options (flat, as the old editor saved them). */
export interface OverlayClip {
  id: string;
  type: OverlayKind;
  name: string;
  start: number;
  end: number;
  [option: string]: unknown;
}

export interface WorkspaceState {
  activeTab: ProjectTab;
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  spaces: WorkflowSpace[];
  activeSpaceId: string;
  openSpaceIds: Set<string>;
  assets: Asset[];
  mediaFolders: MediaFolder[];
  timelines: Timeline[];
  activeTimelineId: string;
  openTimelineIds: Set<string>;
  currentRun: WorkflowRun | null;
  runningNodeIds: Set<string>;
  exports: ExportJob[];
  elements: Element[];
  elementFolders: ElementFolder[];
  director: DirectorShow;
  providerUsage: ProjectProviderUsage;
  sets: ProjectSet[];
  /** [remix] Interactive overlays drawn over the video (Lead Generator, List Builder, CTA) — the old editor's add-on clips. */
  overlays: OverlayClip[];
}
