// [remix] OpenChatCut keys its UI strings by the Chinese original and ships an English dictionary (dict/en, copied here
// unchanged). This is the English-only lookup of their `t()`; unknown strings fall back to the original.
// Four effect names have no entry in their English dictionary, so they are listed here.
import { EN } from './index';
const MISSING_UPSTREAM: Record<string, string> = { '三路色轮': 'Color Wheels', '高光/阴影': 'Highlights / Shadows', '清晰度': 'Clarity', 'HSL 定向调整': 'HSL Qualify' };
export const t = (zh: string): string => EN[zh] ?? MISSING_UPSTREAM[zh] ?? zh;
