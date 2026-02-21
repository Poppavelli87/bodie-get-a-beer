# Bodie Get A Beer

Bodie Get A Beer is a fast arcade time-management game about balancing wrench work and bad decisions. Fix cars for points, drink to boost your multiplier, and avoid puking or getting KO'd before the shift ends.

## New in v1.1

- Reworked intoxication into a layered model: `BAC` is now the source of truth and `DrunkMeter` is a curved UI projection. Beer effects linger longer and decay more smoothly.
- Added hydration/tolerance interactions, sustained-high intoxication puke logic, BAC overload KO checks, and a post-KO hangover crash window.
- Added a flow pacing perk for keeping DrunkMeter in the 70-85 zone: it builds momentum for better repair speed and streak value.
- Added an animated **Bodie Stage** panel with state-driven action animations (idle, repair, drink, cigarette, dab, puke, KO) plus rotating comedic captions.

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

## Mobile Play

Mobile optimization now auto-detects touch + small-screen form factors with no setup:

- **Adaptive layouts**
  - Desktop (`>=900px`): original multi-panel setup.
  - Mobile portrait: stacked single-column panels with collapsible Queue/Bodie/Log and a default-collapsed log.
  - Mobile landscape: two-column split with queue/log on the left and actions/Bodie on the right.
- **Fixed Action Dock (mobile only)**
  - Always-visible actions: Drink, Fix, Cig, Dab, Thing, Pause.
  - Segmented beer picker (Light/Tallboy/IPA/Mystery).
  - Selected car indicator + quick select buttons for top queue cars.
- **Touch-first behavior**
  - Minimum 44px tap targets.
  - Touch-action tuned to reduce accidental zoom/scroll during gameplay.
  - iOS/WebAudio unlock on first interaction.
- **Performance and comfort**
  - Log capped to latest 30 lines.
  - Queue rendering is DOM-cached and only updates when queue state changes.
  - Auto-pause via Page Visibility API when tab goes background.
  - Reduced-motion support and lower visual effect strength on mobile.
- **Compact Mode setting**
  - Header toggle cycles `Auto -> On -> Off` and stores preference in `localStorage`.
  - Auto mode enables compact UI on small screens.

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
