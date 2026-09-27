import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "./api";
import type { GoogleMeetStatus, Member } from "./types";

// 保存したら全部の一覧を取り直す。件数の少ない業務アプリなので、これで十分
export function useAction<V, R = unknown>(
  fn: (vars: V) => Promise<R>,
  options: { success?: string; onSuccess?: (result: R) => void } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries();
      if (options.success) toast.success(options.success);
      options.onSuccess?.(result);
    },
    onError: (e) => toast.error(e.message),
  });
}

// Better Auth のクライアントはエラーを投げずに { error } で返すので、例外にそろえる
export async function unwrap<T>(p: Promise<{ data: T | null; error: { message?: string } | null }>): Promise<T> {
  const res = await p;
  if (res.error) throw new Error(res.error.message ?? "操作に失敗しました");
  return res.data as T;
}

export function useMembers() {
  return useQuery({ queryKey: ["members"], queryFn: () => api<Member[]>("/members") });
}

export function useGoogleMeetStatus() {
  return useQuery({ queryKey: ["google-meet-status"], queryFn: () => api<GoogleMeetStatus>("/google-meet/status") });
}

export function useActiveMemberOptions(keepIds: (number | null | undefined)[] = []) {
  const { data = [] } = useMembers();
  return data.filter((m) => m.isActive || keepIds.includes(m.id)).map((m) => ({ value: String(m.id), label: m.name }));
}
