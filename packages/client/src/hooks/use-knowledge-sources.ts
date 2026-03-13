// ──────────────────────────────────────────────
// React Query: Knowledge Source file hooks
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";

export interface KnowledgeSource {
  id: string;
  originalName: string;
  filename: string;
  size: number;
  uploadedAt: string;
}

const ksKeys = {
  all: ["knowledge-sources"] as const,
  list: () => [...ksKeys.all, "list"] as const,
};

export function useKnowledgeSources() {
  return useQuery({
    queryKey: ksKeys.list(),
    queryFn: () => api.get<KnowledgeSource[]>("/knowledge-sources"),
    staleTime: 60_000,
  });
}

export function useUploadKnowledgeSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/knowledge-sources/upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      return res.json() as Promise<KnowledgeSource>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ksKeys.all });
    },
  });
}

export function useDeleteKnowledgeSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/knowledge-sources/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ksKeys.all });
    },
  });
}
