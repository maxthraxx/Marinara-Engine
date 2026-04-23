// ──────────────────────────────────────────────
// Game: Session History Panel (view past sessions)
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { History, ChevronDown, ChevronRight, ScrollText, Users, Sparkles, X } from "lucide-react";
import type { SessionSummary } from "@marinara-engine/shared";
import { toast } from "sonner";
import { AnimatedText } from "./AnimatedText";

function normalizeText(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function normalizeTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

function normalizeStatsSnapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function deriveResumePointFallback(summary: string): string {
  const paragraphs = summary
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  return paragraphs[paragraphs.length - 1] ?? summary;
}

function formatListDraft(items: string[]): string {
  return items.join("\n");
}

function parseListDraft(value: string): string[] {
  return value
    .split("\n")
    .map((item) => normalizeText(item))
    .filter((item) => item.length > 0);
}

interface SessionSummaryDraft {
  summary: string;
  resumePoint: string;
  partyDynamics: string;
  partyState: string;
  keyDiscoveries: string;
  revelations: string;
  characterMoments: string;
  npcUpdates: string;
  statsSnapshot: string;
}

interface GameSessionHistoryProps {
  summaries: SessionSummary[];
  currentSessionNumber: number;
  savingSessionNumber?: number | null;
  onSaveSession?: (sessionNumber: number, session: SessionSummary) => Promise<void> | void;
  onClose: () => void;
}

export function GameSessionHistory({
  summaries,
  currentSessionNumber,
  savingSessionNumber = null,
  onSaveSession,
  onClose,
}: GameSessionHistoryProps) {
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [editingSession, setEditingSession] = useState<number | null>(null);
  const [draft, setDraft] = useState<SessionSummaryDraft | null>(null);

  const sorted = useMemo(() => {
    const normalized = (Array.isArray(summaries) ? summaries : []).map((session, index) => {
      const raw = (session ?? {}) as Partial<SessionSummary> & Record<string, unknown>;
      const summary = normalizeText(raw.summary, `Session ${index + 1} concluded.`);
      return {
        sessionNumber: index + 1,
        summary,
        resumePoint: normalizeText(raw.resumePoint, deriveResumePointFallback(summary)),
        partyDynamics: normalizeText(raw.partyDynamics),
        partyState: normalizeText(raw.partyState),
        keyDiscoveries: normalizeTextList(raw.keyDiscoveries),
        revelations: normalizeTextList(raw.revelations),
        characterMoments: normalizeTextList(raw.characterMoments),
        npcUpdates: normalizeTextList(raw.npcUpdates),
        statsSnapshot: normalizeStatsSnapshot(raw.statsSnapshot),
        timestamp: normalizeText(raw.timestamp, new Date().toISOString()),
      } satisfies SessionSummary;
    });

    return normalized.sort((a, b) => b.sessionNumber - a.sessionNumber);
  }, [summaries]);

  const handleStartEditing = (session: SessionSummary) => {
    setEditingSession(session.sessionNumber);
    setDraft({
      summary: session.summary,
      resumePoint: session.resumePoint,
      partyDynamics: session.partyDynamics,
      partyState: session.partyState,
      keyDiscoveries: formatListDraft(session.keyDiscoveries),
      revelations: formatListDraft(session.revelations),
      characterMoments: formatListDraft(session.characterMoments),
      npcUpdates: formatListDraft(session.npcUpdates),
      statsSnapshot: JSON.stringify(session.statsSnapshot, null, 2),
    });
  };

  const handleCancelEditing = () => {
    setEditingSession(null);
    setDraft(null);
  };

  const handleSaveSession = async (session: SessionSummary) => {
    if (!onSaveSession || !draft) return;

    let statsSnapshot: Record<string, unknown> = {};
    const statsSnapshotInput = draft.statsSnapshot.trim();
    if (statsSnapshotInput) {
      try {
        const parsed = JSON.parse(statsSnapshotInput);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Stats snapshot must be a JSON object.");
        }
        statsSnapshot = parsed as Record<string, unknown>;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Stats snapshot must be valid JSON.");
        return;
      }
    }

    try {
      await onSaveSession(session.sessionNumber, {
        sessionNumber: session.sessionNumber,
        summary: draft.summary.trim(),
        resumePoint: draft.resumePoint.trim(),
        partyDynamics: draft.partyDynamics.trim(),
        partyState: draft.partyState.trim(),
        keyDiscoveries: parseListDraft(draft.keyDiscoveries),
        revelations: parseListDraft(draft.revelations),
        characterMoments: parseListDraft(draft.characterMoments),
        npcUpdates: parseListDraft(draft.npcUpdates),
        statsSnapshot,
        timestamp: session.timestamp,
      });
      setEditingSession(null);
      setDraft(null);
    } catch {
      // The parent handles the error toast and keeps the draft intact.
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[var(--card)]/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <History size={16} className="text-[var(--muted-foreground)]" />
          <span className="text-sm font-semibold text-[var(--foreground)]">Session History</span>
          <span className="text-xs text-[var(--muted-foreground)]">
            ({sorted.length} past session{sorted.length !== 1 ? "s" : ""})
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-[var(--muted-foreground)]">
            <ScrollText size={24} className="opacity-50" />
            <span className="text-sm">No completed sessions yet</span>
            <span className="text-xs">Conclude your current session to see a summary here.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map((session) => {
              const isExpanded = expandedSession === session.sessionNumber;
              const isEditing = editingSession === session.sessionNumber;
              const isSaving = savingSessionNumber === session.sessionNumber;
              const date = new Date(session.timestamp);
              const dateStr = date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <div key={session.sessionNumber} className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
                  <button
                    onClick={() => setExpandedSession(isExpanded ? null : session.sessionNumber)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--accent)]"
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-[var(--muted-foreground)]" />
                    ) : (
                      <ChevronRight size={14} className="text-[var(--muted-foreground)]" />
                    )}
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      Session {session.sessionNumber}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">{dateStr}</span>
                    <span className="ml-auto text-xs text-[var(--muted-foreground)]">
                      {session.keyDiscoveries.length} discoveries
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[var(--border)] px-4 py-3">
                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                            <ScrollText size={12} />
                            Summary
                          </div>
                          {onSaveSession && !isEditing && (
                            <button
                              onClick={() => handleStartEditing(session)}
                              className="rounded-md bg-[var(--secondary)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                            >
                              Edit Details
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                Summary
                              </span>
                              <textarea
                                value={draft?.summary ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, summary: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={8}
                                className="min-h-32 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                Resume Point
                              </span>
                              <textarea
                                value={draft?.resumePoint ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, resumePoint: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={4}
                                placeholder="How the next session should resume"
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                Party Dynamics
                              </span>
                              <textarea
                                value={draft?.partyDynamics ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, partyDynamics: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={4}
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                Party State
                              </span>
                              <textarea
                                value={draft?.partyState ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, partyState: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={3}
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                Key Discoveries
                              </span>
                              <textarea
                                value={draft?.keyDiscoveries ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, keyDiscoveries: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={4}
                                placeholder="One discovery per line"
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                Revelations
                              </span>
                              <textarea
                                value={draft?.revelations ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, revelations: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={4}
                                placeholder="One revelation per line"
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                Character Moments
                              </span>
                              <textarea
                                value={draft?.characterMoments ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, characterMoments: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={4}
                                placeholder="One moment per line"
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                NPC Updates
                              </span>
                              <textarea
                                value={draft?.npcUpdates ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, npcUpdates: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={4}
                                placeholder="One update per line"
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                Stats Snapshot JSON
                              </span>
                              <textarea
                                value={draft?.statsSnapshot ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, statsSnapshot: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={8}
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]"
                              />
                            </label>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={handleCancelEditing}
                                disabled={isSaving}
                                className="rounded-md bg-[var(--secondary)] px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => void handleSaveSession(session)}
                                disabled={isSaving || !(draft?.summary ?? "").trim()}
                                className="rounded-md bg-[var(--primary)] px-2.5 py-1.5 text-[0.6875rem] font-medium text-white transition-colors hover:bg-[var(--primary)]/90 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isSaving ? "Saving..." : "Save Details"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <AnimatedText
                              html={session.summary}
                              className="text-sm leading-relaxed text-[var(--foreground)]"
                            />
                            {session.resumePoint && (
                              <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2">
                                <div className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                  Resume Point
                                </div>
                                <AnimatedText
                                  html={session.resumePoint}
                                  className="text-xs leading-relaxed text-[var(--foreground)]"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {session.partyDynamics && (
                        <div className="mb-3">
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                            <Users size={12} />
                            Party Dynamics
                          </div>
                          <AnimatedText html={session.partyDynamics} className="text-sm text-[var(--foreground)]" />
                        </div>
                      )}

                      {session.keyDiscoveries.length > 0 && (
                        <div className="mb-3">
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                            <Sparkles size={12} />
                            Key Discoveries
                          </div>
                          <ul className="flex flex-col gap-1 pl-4">
                            {session.keyDiscoveries.map((discovery, i) => (
                              <li key={i} className="list-disc text-xs text-[var(--foreground)]">
                                <AnimatedText html={discovery} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {session.revelations.length > 0 && (
                        <div className="mb-3">
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                            <Sparkles size={12} />
                            Revelations
                          </div>
                          <ul className="flex flex-col gap-1 pl-4">
                            {session.revelations.map((revelation, i) => (
                              <li key={i} className="list-disc text-xs text-[var(--foreground)]">
                                <AnimatedText html={revelation} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {session.characterMoments.length > 0 && (
                        <div className="mb-3">
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                            <Users size={12} />
                            Character Moments
                          </div>
                          <ul className="flex flex-col gap-1 pl-4">
                            {session.characterMoments.map((moment, i) => (
                              <li key={i} className="list-disc text-xs text-[var(--foreground)]">
                                <AnimatedText html={moment} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {session.npcUpdates.length > 0 && (
                        <div className="mb-3">
                          <div className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">NPC Updates</div>
                          <ul className="flex flex-col gap-1 pl-4">
                            {session.npcUpdates.map((update, i) => (
                              <li key={i} className="list-disc text-xs text-[var(--foreground)]">
                                <AnimatedText html={update} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {Object.keys(session.statsSnapshot).length > 0 && (
                        <div className="mb-3">
                          <div className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">Stats Snapshot</div>
                          <pre className="overflow-x-auto rounded-lg bg-[var(--secondary)] p-3 font-mono text-[0.6875rem] leading-relaxed text-[var(--foreground)] whitespace-pre-wrap break-words">
                            {JSON.stringify(session.statsSnapshot, null, 2)}
                          </pre>
                        </div>
                      )}

                      {session.partyState && (
                        <div className="mt-3 rounded bg-[var(--card)] p-2 text-xs text-[var(--muted-foreground)]">
                          <span className="font-medium">Party Status:</span> <AnimatedText html={session.partyState} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border)] px-4 py-2 text-center text-xs text-[var(--muted-foreground)]">
        Currently in Session {currentSessionNumber}
      </div>
    </div>
  );
}
