# Prompt 3: The Haus

Status: Phase A on Next `/haus`. Salon, Library, Guide, Reserve, Events, Ritual, and Account suites stay parked.
Source: July 22 Bond Prompt 3 The Haus, adjusted 2026-09-15.
Depends on: Prompt 2A shared door, W-2026-09-15-P1-OVERRIDE, Framer tokens, BV-05 / BV-06 / BV-08 (later phases).

## Phase A (this branch)

Shared door at `/haus`. After password:

- `admin` / `owner` / `operator` from `public.admins` open `/vauxhall`. Password only under the Phase 1 waiver. MFA is not restored.
- Demo member `member@bond.test` / any password is member only. Never grant Vauxhall.
- First member visit: welcome interstitial, 21+ checkbox once, then `/haus/salon` stub (frame and Sign Out only). Empty shelf seed.
- Later member visits skip welcome when the ack cookie already holds welcome and age.
- Neutral fail: That did not open the door.
- Unauth member rooms return to `/haus`. Unauth `/vauxhall` stays 404. `/Haus.dc.html` stays 404.
- Admin footer on Home stays `/haus`. No `/haus/admin`.

Door copy:

- Didot: The Haus is for members.
- Caption: Membership is by invitation from the Circle.
- Reciprocal Circle: Not yet a member? Join the Circle for first access. (`/#haus`)
- Public compliance band.

## Parked

- Phase B: Salon cards, Library, Account erase suite
- Phase C: Guide, Reserve, Events, Ritual
- MFA restore
- `/haus/admin` split
- Commerce, prices, cart
- Health, dose, frequency, or effect tracking
- Metrc live / Social publish

## Routes

| Room | Path | Phase A |
| --- | --- | --- |
| Door | `/haus` | Live |
| Welcome | `/haus/welcome` | Live, once |
| Salon | `/haus/salon` | Stub frame |
| Library | `/haus/library` | Redirect to Salon |
| Guide | `/haus/guide` | Redirect to Salon |
| Reserve | `/haus/reserve` | Redirect to Salon |
| Events | `/haus/events` | Redirect to Salon |
| Ritual | `/haus/ritual` | Redirect to Salon |
| Account | `/haus/account` | Redirect to Salon |

Archive of the July 22 source: `/canon/archives/prompt-3-the-haus-july22.md`
Flags: `/canon/specs/prompt-3-flags.md`
