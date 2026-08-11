# LiveKit Meeting Staging Validation

Branch baseline: `fix/livekit-meeting-stability`

## How to observe

```js
localStorage.setItem("genmeet_meeting_debug", "1");
// optional VB failure simulation (dev only):
localStorage.setItem("genmeet_vb_force_fail", "1");
```

Console format:

```text
[GENMEET][<8-char debugSessionId>] HH:MM:SS.mmm EVENT { ... }
```

`debugSessionId` is **logging only** — never LiveKit participant identity.

Disconnect reasons are LiveKit `DisconnectReason` enum names via reverse mapping (e.g. `CLIENT_INITIATED`, `DUPLICATE_IDENTITY`, `PARTICIPANT_REMOVED`, `ROOM_DELETED`, `JOIN_FAILURE`, `UNKNOWN`).

## Production gate (must PASS before production)

- Basic 2 participant
- Reconnect ~5s
- Network flapping
- Bidirectional audio
- Autoplay recovery
- Chat stress
- VB basic
- VB camera OFF/ON
- VB reconnect
- 5 participant
- 30 minute endurance

10 participant strongly recommended.

## Results matrix

| TEST | DEVICE | BROWSER | PARTICIPANTS | RESULT | ISSUE | NOTES |
|------|--------|---------|--------------|--------|-------|-------|
| A1 Basic 2p A/V + chat 5min | — | — | 2 | NOT TESTED | — | Needs Chrome A + Chrome B |
| B1 Reconnect 5s | — | — | 2 | NOT TESTED | — | Highest priority |
| C1 Network flapping ×5 | — | — | 2 | NOT TESTED | — | Watch TRACK_PUBLISHED spam |
| D1 Final disconnect | — | — | 1–2 | NOT TESTED | — | Record DisconnectReason |
| E1 Audio autoplay unlock | — | — | 2 | NOT TESTED | — | Fresh session / Safari |
| F1 Audio stress mute×20 cam×10 | — | — | 3+ | NOT TESTED | — | |
| G1 Chat open/close×30 + 50 msgs | — | — | 3+ | NOT TESTED | — | No ROOM_CONNECTING on open |
| H1 VB basic + 10 swaps | — | — | 1–2 | NOT TESTED | — | Person must remain visible |
| I1 VB + cam OFF/ON + device + reconnect | — | — | 1–2 | NOT TESTED | — | |
| J1 VB force fail | — | — | 1 | NOT TESTED | — | `genmeet_vb_force_fail=1` |
| K1 5 participants | — | — | 5 | NOT TESTED | — | |
| L1 10 participants | — | — | 10 | NOT TESTED | — | |
| Endurance 30min | — | — | 2+ | NOT TESTED | — | Watch memory / listeners |

## Automated (fill after CI/local run)

| Check | RESULT | NOTES |
|-------|--------|-------|
| Typecheck | NOT TESTED | |
| Vitest | NOT TESTED | |
| Build | NOT TESTED | |

## Failure report template

```text
TEST:
EXPECTED:
ACTUAL:
LOG:
CONNECTION STATE:
DISCONNECT REASON:
TRACK STATE:
LIKELY ROOT CAUSE:
FILES INVOLVED:
```

Then: **STOP** → minimal fix for that subsystem only → retest failed case → retest A1 + audio + chat + reconnect → continue.
