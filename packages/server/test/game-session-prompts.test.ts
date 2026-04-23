import test from "node:test";
import assert from "node:assert/strict";
import type { SessionSummary } from "@marinara-engine/shared";
import { buildGmSystemPrompt, buildSessionSummaryPrompt } from "../src/services/game/gm-prompts.js";
import { buildRecapPrompt } from "../src/services/game/session.service.js";

function makeSummary(overrides: Partial<SessionSummary>): SessionSummary {
  return {
    sessionNumber: overrides.sessionNumber ?? 1,
    summary: overrides.summary ?? "Session summary.",
    resumePoint: overrides.resumePoint ?? "Resume point.",
    partyDynamics: overrides.partyDynamics ?? "Party dynamics.",
    partyState: overrides.partyState ?? "Party state.",
    keyDiscoveries: overrides.keyDiscoveries ?? [],
    revelations: overrides.revelations ?? [],
    characterMoments: overrides.characterMoments ?? [],
    statsSnapshot: overrides.statsSnapshot ?? {},
    npcUpdates: overrides.npcUpdates ?? [],
    timestamp: overrides.timestamp ?? "2026-04-23T00:00:00.000Z",
  };
}

test("GM prompt includes every prior session summary but only the latest session detail block", () => {
  const prompt = buildGmSystemPrompt({
    gameActiveState: "exploration",
    storyArc: null,
    plotTwists: null,
    map: null,
    npcs: [],
    sessionSummaries: [
      makeSummary({
        sessionNumber: 1,
        summary: "Session one summary with the old bridge fight.",
        resumePoint: "Resume from the ruined bridge.",
        partyDynamics: "session-one-dynamics",
        keyDiscoveries: ["session-one-discovery"],
        revelations: ["session-one-revelation"],
        characterMoments: ["session-one-moment"],
        npcUpdates: ["session-one-npc-update"],
        statsSnapshot: { marker: "session-one-stats" },
      }),
      makeSummary({
        sessionNumber: 2,
        summary: "Session two summary with the archive break-in.",
        resumePoint: "Resume from the archive vault.",
        partyDynamics: "session-two-dynamics",
        keyDiscoveries: ["session-two-discovery"],
        revelations: ["session-two-revelation"],
        characterMoments: ["session-two-moment"],
        npcUpdates: ["session-two-npc-update"],
        statsSnapshot: { marker: "session-two-stats" },
      }),
      makeSummary({
        sessionNumber: 3,
        summary: "Session three summary with the observatory collapse.",
        resumePoint: "Resume with the party hanging from the observatory lift.",
        partyDynamics: "session-three-dynamics",
        keyDiscoveries: ["session-three-discovery"],
        revelations: ["session-three-revelation"],
        characterMoments: ["session-three-moment"],
        npcUpdates: ["session-three-npc-update"],
        statsSnapshot: { marker: "session-three-stats" },
      }),
    ],
    sessionNumber: 4,
    partyNames: ["Aster"],
    playerName: "Mari",
    playerCard: null,
    gmCharacterCard: null,
    difficulty: "normal",
    genre: "fantasy",
    setting: "original",
    tone: "balanced",
  });

  assert.match(prompt, /Session 1 summary:\nSession one summary with the old bridge fight\./);
  assert.match(prompt, /Session 2 summary:\nSession two summary with the archive break-in\./);
  assert.match(prompt, /Session 3 summary:\nSession three summary with the observatory collapse\./);
  assert.match(prompt, /<latest_session_continuity>/);
  assert.match(prompt, /Latest completed session: 3/);
  assert.match(prompt, /Resume point: Resume with the party hanging from the observatory lift\./);
  assert.match(prompt, /Party dynamics: session-three-dynamics/);
  assert.match(prompt, /Key discoveries: session-three-discovery/);
  assert.doesNotMatch(prompt, /session-one-dynamics/);
  assert.doesNotMatch(prompt, /session-two-discovery/);
  assert.doesNotMatch(prompt, /session-one-revelation/);
  assert.doesNotMatch(prompt, /session-two-npc-update/);
  assert.doesNotMatch(prompt, /session-one-stats/);
});

test("session summary prompt requires a resume point and cross-field dedupe", () => {
  const prompt = buildSessionSummaryPrompt("Polish");

  assert.match(prompt, /resumePoint/);
  assert.match(prompt, /Each fact belongs in the single best category only once\./);
  assert.match(prompt, /Language: write every natural-language value in Polish\./);
  assert.match(prompt, /Output valid JSON only\./);
});

test("recap prompt includes the stored resume point and the final narrated beat", () => {
  const prompt = buildRecapPrompt(
    [
      makeSummary({
        sessionNumber: 4,
        summary: "The party escaped the citadel and reached the collapsing skybridge.",
        resumePoint: "Resume with the party stranded on the collapsing skybridge as alarms ring.",
        partyDynamics: "The party finally trusted each other under pressure.",
        keyDiscoveries: ["The regent controls the warding engine."],
      }),
    ],
    "[Narrator] The last cable snaps and the bridge pitches sideways.",
  );

  assert.match(prompt, /Resume point: Resume with the party stranded on the collapsing skybridge as alarms ring\./);
  assert.match(prompt, /The final narrated beat immediately before the session ended was:/);
  assert.match(prompt, /The last cable snaps and the bridge pitches sideways\./);
});