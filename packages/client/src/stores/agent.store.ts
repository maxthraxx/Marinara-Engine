// ──────────────────────────────────────────────
// Zustand Store: Agent Slice
// ──────────────────────────────────────────────
import { create } from "zustand";
import type { AgentResult } from "@marinara-engine/shared";

interface AgentState {
  activeAgents: string[];
  lastResults: Map<string, AgentResult>;
  isProcessing: boolean;
  thoughtBubbles: Array<{
    agentId: string;
    agentName: string;
    content: string;
    timestamp: number;
  }>;
  echoMessages: Array<{
    characterName: string;
    reaction: string;
    timestamp: number;
  }>;

  // Actions
  setActiveAgents: (agents: string[]) => void;
  setProcessing: (processing: boolean) => void;
  addResult: (agentId: string, result: AgentResult) => void;
  addThoughtBubble: (agentId: string, agentName: string, content: string) => void;
  dismissThoughtBubble: (index: number) => void;
  clearThoughtBubbles: () => void;
  addEchoMessage: (characterName: string, reaction: string) => void;
  clearEchoMessages: () => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  activeAgents: [],
  lastResults: new Map(),
  isProcessing: false,
  thoughtBubbles: [],
  echoMessages: [],

  setActiveAgents: (agents) => set({ activeAgents: agents }),
  setProcessing: (processing) => set({ isProcessing: processing }),

  addResult: (agentId, result) =>
    set((s) => {
      const results = new Map(s.lastResults);
      results.set(agentId, result);
      // Cap at 50 entries — evict oldest
      if (results.size > 50) {
        const first = results.keys().next().value;
        if (first !== undefined) results.delete(first);
      }
      return { lastResults: results };
    }),

  addThoughtBubble: (agentId, agentName, content) =>
    set((s) => ({
      thoughtBubbles: [...s.thoughtBubbles, { agentId, agentName, content, timestamp: Date.now() }].slice(-50),
    })),

  dismissThoughtBubble: (index) =>
    set((s) => ({
      thoughtBubbles: s.thoughtBubbles.filter((_, i) => i !== index),
    })),

  clearThoughtBubbles: () => set({ thoughtBubbles: [] }),

  addEchoMessage: (characterName, reaction) =>
    set((s) => ({
      echoMessages: [...s.echoMessages, { characterName, reaction, timestamp: Date.now() }].slice(-100),
    })),

  clearEchoMessages: () => set({ echoMessages: [] }),

  reset: () =>
    set({
      activeAgents: [],
      lastResults: new Map(),
      isProcessing: false,
      thoughtBubbles: [],
      echoMessages: [],
    }),
}));
