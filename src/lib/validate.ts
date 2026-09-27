import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";

export const validate = <Target extends keyof ValidationTargets, Schema extends ZodType>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json({ error: result.error.issues.map((i) => i.message).join("\n") }, 400);
    }
  });
