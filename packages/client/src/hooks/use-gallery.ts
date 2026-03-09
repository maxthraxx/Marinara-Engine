// ──────────────────────────────────────────────
// Hook: Chat Gallery Images
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";

export interface ChatImage {
  id: string;
  chatId: string;
  filePath: string;
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  url: string;
}

const galleryKeys = {
  all: ["gallery"] as const,
  chat: (chatId: string) => ["gallery", chatId] as const,
};

export function useGalleryImages(chatId: string | undefined) {
  return useQuery({
    queryKey: galleryKeys.chat(chatId!),
    queryFn: () => api.get<ChatImage[]>(`/gallery/${chatId}`),
    enabled: !!chatId,
    staleTime: 5 * 60_000,
  });
}

export function useUploadGalleryImage(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => api.upload<ChatImage>(`/gallery/${chatId}/upload`, formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: galleryKeys.chat(chatId) });
    },
  });
}

export function useDeleteGalleryImage(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => api.delete(`/gallery/${imageId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: galleryKeys.chat(chatId) });
    },
  });
}
