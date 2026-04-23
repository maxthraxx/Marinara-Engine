// ──────────────────────────────────────────────
// CYOA Choices — interactive choice buttons after assistant messages
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Sparkles, X } from "lucide-react";
import { useUpdateMessageExtra } from "../../hooks/use-chats";
import { useAgentStore } from "../../stores/agent.store";
import { useGenerate } from "../../hooks/use-generate";
import { useChatStore } from "../../stores/chat.store";
import type { Message } from "@marinara-engine/shared";

type CyoaChoice = {
  label: string;
  text: string;
};

interface Props {
  messages?: Message[];
}

function normalizeChoices(choices: CyoaChoice[]) {
  return choices
    .map((choice, index) => ({
      label: choice.label.trim() || `Choice ${index + 1}`,
      text: choice.text.trim(),
    }))
    .filter((choice) => choice.text.length > 0);
}

export function CyoaChoices({ messages }: Props) {
  const choices = useAgentStore((s) => s.cyoaChoices);
  const setCyoaChoices = useAgentStore((s) => s.setCyoaChoices);
  const clearCyoaChoices = useAgentStore((s) => s.clearCyoaChoices);
  const { generate } = useGenerate();
  const activeChatId = useChatStore((s) => s.activeChatId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const updateMessageExtra = useUpdateMessageExtra(activeChatId);
  const [isEditing, setIsEditing] = useState(false);
  const [draftChoices, setDraftChoices] = useState<CyoaChoice[]>([]);

  // Hydrate CYOA choices from the last assistant message's extras on mount / chat switch
  const persistedChoiceState = useMemo(() => {
    if (!messages) return null;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant?.extra) return null;
    let extra: Record<string, unknown>;
    try {
      extra = typeof lastAssistant.extra === "string" ? JSON.parse(lastAssistant.extra) : lastAssistant.extra;
    } catch {
      return null;
    }
    const saved = extra.cyoaChoices as CyoaChoice[] | undefined;
    return saved && saved.length > 0 ? { messageId: lastAssistant.id, choices: saved } : null;
  }, [messages]);

  useEffect(() => {
    if (choices.length > 0 || isStreaming || !persistedChoiceState?.choices) return;
    setCyoaChoices(persistedChoiceState.choices);
  }, [persistedChoiceState, choices.length, isStreaming, setCyoaChoices]);

  const handleChoice = useCallback(
    async (text: string) => {
      if (!activeChatId || isStreaming || isEditing) return;
      clearCyoaChoices();
      await generate({
        chatId: activeChatId,
        connectionId: null,
        userMessage: text,
      });
    },
    [activeChatId, isStreaming, isEditing, clearCyoaChoices, generate],
  );

  const handleStartEdit = useCallback(() => {
    setDraftChoices(choices.map((choice) => ({ ...choice })));
    setIsEditing(true);
  }, [choices]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraftChoices([]);
  }, []);

  const updateDraftChoice = useCallback((index: number, field: keyof CyoaChoice, value: string) => {
    setDraftChoices((prev) =>
      prev.map((choice, choiceIndex) => (choiceIndex === index ? { ...choice, [field]: value } : choice)),
    );
  }, []);

  const handleSaveChoices = useCallback(async () => {
    const normalizedChoices = normalizeChoices(draftChoices);
    if (normalizedChoices.length === 0) return;

    setCyoaChoices(normalizedChoices);
    if (persistedChoiceState?.messageId) {
      await updateMessageExtra.mutateAsync({
        messageId: persistedChoiceState.messageId,
        extra: { cyoaChoices: normalizedChoices },
      });
    }

    setIsEditing(false);
    setDraftChoices([]);
  }, [draftChoices, persistedChoiceState?.messageId, setCyoaChoices, updateMessageExtra]);

  if (choices.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-2 px-4 py-3 animate-message-in">
      <div className="flex items-center gap-2 text-[0.625rem] text-white/30">
        <div className="flex items-center gap-1.5">
          <Sparkles size="0.625rem" />
          <span>What will you do?</span>
        </div>
        <button
          type="button"
          onClick={isEditing ? handleCancelEdit : handleStartEdit}
          disabled={isStreaming || updateMessageExtra.isPending}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[0.5625rem] text-white/50 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-40"
          title={isEditing ? "Cancel editing choices" : "Edit CYOA choices"}
        >
          <Pencil size="0.625rem" />
          <span>{isEditing ? "Cancel" : "Edit"}</span>
        </button>
      </div>
      {isEditing ? (
        <div className="w-full max-w-[85%] space-y-2 rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur-md">
          {draftChoices.map((choice, index) => (
            <div key={index} className="rounded-xl border border-white/8 bg-black/30 p-3">
              <input
                type="text"
                value={choice.label}
                onChange={(e) => updateDraftChoice(index, "label", e.target.value)}
                placeholder={`Choice ${index + 1}`}
                className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-[0.6875rem] font-semibold text-purple-200 outline-none transition-colors focus:border-purple-400/40"
              />
              <textarea
                value={choice.text}
                onChange={(e) => updateDraftChoice(index, "text", e.target.value)}
                rows={Math.min(Math.max(choice.text.split("\n").length, 2), 6)}
                placeholder="Describe the action or dialogue sent when this choice is clicked."
                className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-[0.6875rem] leading-relaxed text-white/75 outline-none transition-colors focus:border-purple-400/40"
              />
            </div>
          ))}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={updateMessageExtra.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/35 px-3 py-1.5 text-[0.625rem] text-white/60 transition-colors hover:bg-white/10 hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X size="0.75rem" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSaveChoices();
              }}
              disabled={updateMessageExtra.isPending || normalizeChoices(draftChoices).length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[0.625rem] text-emerald-200 transition-colors hover:bg-emerald-500/15 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {updateMessageExtra.isPending ? (
                <Loader2 size="0.75rem" className="animate-spin" />
              ) : (
                <Check size="0.75rem" />
              )}
              <span>{updateMessageExtra.isPending ? "Saving" : "Save Choices"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex max-w-[85%] flex-wrap justify-center gap-2">
          {choices.map((choice, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleChoice(choice.text)}
              disabled={isStreaming}
              className="group relative rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-left backdrop-blur-md transition-all hover:border-purple-400/40 hover:bg-purple-500/10 hover:shadow-lg hover:shadow-purple-500/5 active:scale-[0.98] disabled:opacity-50"
            >
              <span className="block text-[0.6875rem] font-semibold text-purple-300/90 group-hover:text-purple-200">
                {choice.label}
              </span>
              <span className="mt-0.5 block text-[0.625rem] leading-relaxed text-white/50 group-hover:text-white/70">
                {choice.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
