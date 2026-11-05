import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import type { CardDef, PropField } from "../cards/types";

/** 把工作台的 PropField schema 转成 Zod schema——Studio Inspector 据此渲染表单控件 */
const fieldToZod = (f: PropField): z.ZodTypeAny => {
  switch (f.type) {
    case "text":
    case "textarea":
      return z.string().describe(f.label);
    case "number":
    case "slider": {
      let n = z.number();
      if (f.min !== undefined) n = n.min(f.min);
      if (f.max !== undefined) n = n.max(f.max);
      return n.describe(f.label);
    }
    case "color":
      // @remotion/zod-types 4.0.484 is typed against a different zod minor than
      // this repo pins; the runtime shape is identical, so cast through.
      return zColor().describe(f.label) as unknown as z.ZodTypeAny;
    case "select":
      return z
        .enum(f.options.map((o) => o.value) as [string, ...string[]])
        .describe(f.label);
    case "boolean":
      return z.boolean().describe(f.label);
  }
};

export const zodFromCard = (card: CardDef) =>
  z.object(Object.fromEntries(card.schema.map((f) => [f.key, fieldToZod(f)])));
