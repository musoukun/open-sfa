import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { z, type ZodType } from "zod";

// 設定ファイルの選択肢のキーか、未設定を表す空文字だけを受け付ける
export const choiceOrEmpty = (choices: Record<string, string>, message: string) =>
  z
    .string()
    .default("")
    .refine((v) => v === "" || Object.hasOwn(choices, v), message);

export const validate = <Target extends keyof ValidationTargets, Schema extends ZodType>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json({ error: result.error.issues.map((i) => i.message).join("\n") }, 400);
    }
  });
