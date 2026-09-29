import type { SessionUser } from "../auth";
import type { DealEventKind, DealStage } from "./rules";

// 案件の動きを1件残すためのデータ。呼び出し側のトランザクションの中で create する
export function dealEvent(dealId: number, kind: DealEventKind, fromStage: DealStage | null, toStage: DealStage | null, user: Pick<SessionUser, "id" | "name">) {
  return { dealId, kind, fromStage, toStage, changedById: user.id, changedByName: user.name };
}
