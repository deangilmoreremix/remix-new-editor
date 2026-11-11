import type { ProjectData, SessionData } from "../types";
import { uid, projectDuration } from "../types";
import { framesToSec } from "../time";
import { useStore } from "../store";
import { interpretAgentCommand, type AgentContext, type AgentOp } from "./agentCommands";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * 报当前工作台工程为可保存的会话快照。
 *
 * 会话同时保存：工程快照、配方（recipeId）、以及与 Agent 的对话（messages，空数组起步）。
 * messageCount 是真实的对话条数（片段数用 `sessionClipCount`）。
 */
export const projectToSession = (
  project: ProjectData,
  name?: string,
  prompt?: string,
  recipeId?: string,
  recipeName?: string,
): SessionData => {
  const width = project.width ?? 1920;
  const height = project.height ?? 1080;
  const g = gcd(width, height);
  const fps = project.fps ?? 30;
  return {
    id: uid("session"),
    name: name ?? "Untitled Session",
    prompt,
    aspectRatio: `${width / g}:${height / g}`,
    duration: Math.round(framesToSec(projectDuration(project), fps) * 10) / 10,
    projectSnapshot: clone(project),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
    recipeId,
    recipeName,
    messages: [],
  };
};

/** 还原会话为工程数据（直接返回快照副本）。 */
export const sessionToProject = (session: SessionData): ProjectData =>
  clone(session.projectSnapshot);

/** 把会话载入工作台：工程切换为会话快照，并把会话设为当前会话。 */
type MotionStore = typeof useStore;
export const applySession = (store: MotionStore, session: SessionData): void => {
  const state = store.getState();
  state.setProject(session.projectSnapshot);
  state.selectSession(session.id);
};

/**
 * 把会话里的对话还原成可重放的改动（ops）。
 *
 * 会话记的是「用户说了什么 + Agent 改了什么」，所以按顺序重跑用户那几句就能
 * 复现同样的改动；`ctx` 用当前工程与卡片表，落在当前工程上。
 */
export const sessionToOps = (session: SessionData, ctx: AgentContext): AgentOp[] => {
  const ops: AgentOp[] = [];
  for (const msg of session.messages ?? []) {
    if (msg.role !== "user") continue;
    ops.push(...interpretAgentCommand(msg.content, ctx).ops);
  }
  return ops;
};
