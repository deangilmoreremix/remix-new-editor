// [remix] OpenChatCut keys its UI strings by the Chinese original and ships an English dictionary (dict/en, copied here
// unchanged). This is the English-only lookup of their `t()`; unknown strings fall back to the original.
import { EN } from './index';
export const t = (zh: string): string => EN[zh] ?? zh;
