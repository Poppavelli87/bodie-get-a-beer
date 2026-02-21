# Bodie Get A Beer

Bodie Get A Beer is a fast arcade time-management game about balancing wrench work and bad decisions. Fix cars for points, drink to boost your multiplier, and avoid puking or getting KO'd before the shift ends.

## New in v1.1

- Reworked intoxication into a layered model: `BAC` is now the source of truth and `DrunkMeter` is a curved UI projection. Beer effects linger longer and decay more smoothly.
- Added hydration/tolerance interactions, sustained-high intoxication puke logic, BAC overload KO checks, and a post-KO hangover crash window.
- Added a flow pacing perk for keeping DrunkMeter in the 70-85 zone: it builds momentum for better repair speed and streak value.
- Added an animated **Bodie Stage** panel with state-driven action animations (idle, repair, drink, cigarette, dab, puke, KO) plus rotating comedic captions.


## Drunk Mind Engine (v1.2)

Bodie now has a structured voice system that reacts to run state in real time:

- **Voice stage (0-5)** tracks intoxication and escalates from loose mechanic banter to cosmic nonsense.
- **Short-lived modalities** can temporarily take over (10-30s), including:
  - Philosophical Mechanic
  - Conspiracy Gremlin
  - Shop Wizard
  - Nihilist Smoker
  - Dab Time Sage
  - Angry Bolt Prosecutor
  - Cosmic Transmission (near KO)
- **Context-driven banter triggers** fire on repairs, drinks, cigs/dabs, puke/KO events, streak changes, and car selection.
- **Anti-spam guardrails**:
  - regular banter obeys cooldowns with a hard floor of 4 seconds
  - “big” lines are limited to roughly every 10-15 seconds
  - recent-line history prevents repetitive loops
- **Settings**:
  - `Bodie Banter` On/Off (default On)
  - `Banter Frequency` Low / Normal / High (default Normal)

Log styling now adds subtle stage-based text effects for Bodie lines (mild jitter at high stages and slight glow near cosmic stage) while preserving readability.

## How To Run

1. Open `index.html` in any modern browser.
2. No build step and no server are required.

## Gameplay

- You have a 3-minute shift.
- Cars enter the queue over time, including harder/high-value jobs later.
- Pick a car, repair it, and score on completion:
  - `score = basePoints * drunkMultiplier * streakBonus`
- Your `DrunkMeter` drains constantly.
- Drinking raises `DrunkMeter` and `PukeRisk`.
- If `DrunkMeter` is too high too long, bad events trigger.

### Multipliers

- `0-20%` DrunkMeter: `0.8x`
- `21-60%`: `1.0x`
- `61-85%`: `2.0x`
- `86-100%`: `3.0x` (high risk)

### Mechanical Enlightenment Streak

- Keep DrunkMeter between `70%` and `85%`.
- Every 5 seconds in-range increases streak tier and bonus.
- Leaving range, puking, or KO resets streak.

### Events

- **Puke event**: rapid click/tap or key mash in 2 seconds.
  - Success: smaller penalties.
  - Fail: bigger score/time/meter penalties.
- **KO event**: triggered by overloading DrunkMeter at max.
  - Screen fades, Bodie wakes up later with lost time and reset streak.

### Bonus Actions

- **Bum Cigarette**: small score + stability buff, slight backfire chance.
- **Smoke Dab**: bigger score + repair speed boost, higher paranoia risk.
- **Do A Thing**: random goofy outcomes (great, weird, or terrible).

## Character Visuals

- **Dirt progression (motor oil):** Bodie now tracks persistent run grime (`0..100`) that rises when repairs finish and lightly decays over time. Dirt maps to six visual stages from "clean-ish human" to "sentient oil slick," with stage-crossing gag logs.
- **Disheveled progression:** Bodie’s hair, eyes, posture tilt/wobble, face flush, shirt tuck, and foam drip react live to intoxication (`BAC`/DrunkMeter). Higher drunkenness levels make him increasingly gremlin-coded.
- **Repair styles:** Repairs now use style-specific animation sub-modes (`repairing_wrench`, `repairing_pour`, `repairing_hammer`, `repairing_wiring`) selected per car/tier/type. The final 20% of a repair increases animation intensity for dramatic comedic tension.

## Mobile: Landscape Only

Mobile mode now uses orientation gating + a desktop-like 3-panel landscape layout.

- **Mobile detection (no UA sniffing)**
  - A device is treated as mobile when touch-capable **and** the smaller viewport dimension is `< 800px`.
- **Portrait is blocked**
  - Portrait shows a full-screen **Rotate to Play** overlay with animated CSS phone icon.
  - Gameplay input is blocked in portrait.
  - Optional setting: **Auto-pause portrait** (default ON, saved in `localStorage`).
  - With auto-pause ON, game pauses in portrait and resumes on landscape without reset.
  - With auto-pause OFF, portrait still blocks input, but pause state is not forced.
- **Landscape 3-panel layout (mobileLandscape3)**
  - Uses `VisualViewport` (when available) to set `--vvh/--vvw` CSS vars for real in-app browser viewport sizing.
  - Root layout is grid rows: **HUD**, **stats**, then **3-panel area (`1fr`)**.
  - 3 columns below are clamped to remain visible without horizontal scrolling:
    1. **Queue** (left, internal vertical scroll)
    2. **Bodie Stage + status** (center)
    3. **Actions + compact Log** (right)
- **Tight landscape tier**
  - Triggered when `isMobile && isLandscape && (vh <= 420 || vh/vw <= 0.42)`.
  - Exposed as `body[data-tight="1"]` while retaining `data-layout="mobileLandscape3"`.
  - Collapses to a micro HUD, slimmer meters, inline high score, and compressed spacing while preserving tappable buttons (`40px+`).
  - Only queue/log scroll internally; page scroll is locked.
- **Action panel in tight mode**
  - Prioritizes **Fix/Drink** buttons first, keeps bonus actions compact, and limits log to the most recent entries with an **Expand** toggle.
- **Touch + performance tweaks**
  - `html, body` lock to viewport height with `overflow: hidden`.
  - `touch-action: none` on game shell in mobile landscape to prevent accidental page scrolling/zoom.
  - Queue/log keep `touch-action: pan-y` for internal scroll.
  - Added optional in-game **Layout Debug** overlay in the gear menu.

## Controls

- `1 / 2 / 3 / 4` select beer
- `F` fix selected car
- `D` drink selected beer
- `C` bum cigarette
- `B` smoke dab
- `T` do a thing
- `P` pause
- `R` reset run
- Touch: tap buttons/cards

Extra accessibility keys:

- `Arrow Left/Right` switch beer
- `Arrow Up/Down` switch selected car
- `Enter` fix selected car
- `Space` drink selected beer

## Saved Data

Stored in `localStorage`:

- High score
- Sound setting
- UI settings (compact mode + auto-pause portrait + banter toggles)

## Design Notes

The core loop is a risk-reward tug-of-war:

- Staying too sober keeps points low.
- Staying very drunk spikes rewards but drives puke/KO risk.
- The sweet spot streak (70-85%) pushes deliberate timing decisions.
- All actions consume time and lock out other actions, forcing meaningful tradeoffs between immediate points, multiplier setup, and survival.

## Tuning Knobs (game.js)

Adjust in the `TUNING` object:

- `BASELINE_DRAIN_PER_SEC`
- `PUKERISK_GAIN_PER_SEC` / `PUKERISK_DECAY_PER_SEC`
- `KO_OVERLOAD_MS`
- `PUKE_MASHES_REQUIRED`
- `START_SPAWN_INTERVAL_MS` / `END_SPAWN_INTERVAL_MS`
- `STREAK_STEP_MS` / `STREAK_STEP_MULT`
