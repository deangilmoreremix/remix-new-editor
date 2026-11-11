import { useStore } from "../store";
import type { AgentOp } from "./agentCommands";

/**
 * 把 Agent 解析出的改动真正落到 store 上。
 *
 * 全部走工程已有的 mutator（updateClip / updateClipProps / setThemeColors /
 * addClip / removeClip / setBackground），所以：
 *   - Remotion Player 拿到新的 `project`，自动重渲染
 *   - 撤销栈照常工作（一条指令 = 一步撤销）
 *   - 会话快照订阅（800ms 防抖）会跟上新的工程
 */
export const applyAgentOps = (ops: AgentOp[]): void => {
  if (!ops.length) return;
  let committed = false;
  for (const op of ops) {
    const store = useStore.getState();
    switch (op.kind) {
      case "updateClipProps":
        if (!committed) {
          store.commit();
          committed = true;
        }
        useStore.getState().updateClipProps(op.clipId, op.props);
        break;
      case "updateClip":
        if (!committed) {
          store.commit();
          committed = true;
        }
        useStore.getState().updateClip(op.clipId, op.patch);
        break;
      case "setBackground":
        if (!committed) {
          store.commit();
          committed = true;
        }
        useStore.getState().setBackground(op.color);
        break;
      case "setThemeColors": {
        if (!committed) {
          store.commit();
          committed = true;
        }
        const current = { ...(useStore.getState().project.themeColors ?? {}) };
        useStore.getState().setThemeColors({ ...current, ...op.colors });
        break;
      }
      case "addClip":
        // addClip 自己压一次撤销快照
        useStore.getState().addClip(
          op.cardId,
          op.trackId,
          op.at,
          op.props ? { props: op.props } : undefined,
        );
        break;
      case "removeClip":
        // removeClip 自己压一次撤销快照
        useStore.getState().removeClip(op.clipId);
        break;
    }
  }
};
