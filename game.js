(() => {
  "use strict";

  const STORAGE_KEYS = {
    highScore: "bodie_get_a_beer_high_score",
    settings: "bodie_get_a_beer_settings",
  };

  const STEP_MS = 1000 / 60;
  const MAX_LOG_ENTRIES = 14;

  const TUNING = {
    RUN_DURATION_MS: 3 * 60 * 1000,
    BASELINE_DRAIN_PER_SEC: 4.8,
    SWEET_SPOT_MIN: 70,
    SWEET_SPOT_MAX: 85,
    STREAK_STEP_MS: 5000,
    STREAK_STEP_MULT: 0.08,
    STREAK_MAX_BONUS: 2.1,
    PUKERISK_GAIN_PER_SEC: 18,
    PUKERISK_DECAY_PER_SEC: 8,
    PUKERISK_THRESHOLD: 100,
    PUKERISK_MAX: 120,
    PUKERISK_COOLDOWN_MS: 7500,
    KO_OVERLOAD_MS: 3200,
    KO_WAKE_DELAY_MS: 3200,
    KO_TIME_PENALTY_MS: 6500,
    KO_WAKE_METER: 56,
    KO_WAKE_RISK: 20,
    PUKE_EVENT_MS: 2000,
    PUKE_MASHES_REQUIRED: 17,
    PUKE_FAIL_TIME_PENALTY_MS: 5200,
    PUKE_SUCCESS_TIME_PENALTY_MS: 1800,
    MAX_QUEUE_SIZE: 7,
    START_SPAWN_INTERVAL_MS: 6800,
    END_SPAWN_INTERVAL_MS: 3000,
    REPAIR_CANCEL_KEEP_RATIO: 0.45,
    CIG_EFFECT_MS: 12000,
    CIG_DRAIN_MULTIPLIER: 0.78,
    DAB_EFFECT_MS: 11000,
    DAB_REPAIR_SPEED_MULTIPLIER: 1.3,
    OVERLOAD_DRAIN_MULTIPLIER: 0.45,
  };

  const DRINKS = [
    {
      id: "lager",
      name: "Lite Lager",
      gain: 18,
      risk: 4,
      durationMs: 2100,
      note: "+18 meter / low risk",
    },
    {
      id: "ipa",
      name: "Tallboy IPA",
      gain: 31,
      risk: 9,
      durationMs: 3200,
      note: "+31 meter / medium risk",
    },
    {
      id: "chaos",
      name: "Chaos Malt Bomb",
      gain: 45,
      risk: 24,
      durationMs: 4300,
      note: "+45 meter / high risk",
    },
  ];

  const BONUS_ACTIONS = {
    cigarette: {
      label: "Bumming a cigarette",
      durationMs: 1900,
    },
    dab: {
      label: "Smoking a dab",
      durationMs: 2600,
    },
    thing: {
      label: "Doing a deeply questionable thing",
      durationMs: 2200,
    },
  };

  const CAR_TIERS = [
    {
      label: "Backyard Beater",
      unlockMs: 0,
      weight: 7,
      basePointsMin: 130,
      basePointsMax: 220,
      repairMinMs: 5200,
      repairMaxMs: 7600,
      patienceMinMs: 28000,
      patienceMaxMs: 41000,
    },
    {
      label: "Soccer Van",
      unlockMs: 30000,
      weight: 5,
      basePointsMin: 240,
      basePointsMax: 390,
      repairMinMs: 7600,
      repairMaxMs: 10500,
      patienceMinMs: 23000,
      patienceMaxMs: 34000,
    },
    {
      label: "Turbo Coupe",
      unlockMs: 70000,
      weight: 3,
      basePointsMin: 420,
      basePointsMax: 650,
      repairMinMs: 10200,
      repairMaxMs: 14000,
      patienceMinMs: 19000,
      patienceMaxMs: 29000,
    },
    {
      label: "Cursed Diesel",
      unlockMs: 108000,
      weight: 2,
      basePointsMin: 680,
      basePointsMax: 980,
      repairMinMs: 13600,
      repairMaxMs: 18400,
      patienceMinMs: 16000,
      patienceMaxMs: 25000,
    },
    {
      label: "Midnight Racecar",
      unlockMs: 145000,
      weight: 1,
      basePointsMin: 980,
      basePointsMax: 1450,
      repairMinMs: 17500,
      repairMaxMs: 23000,
      patienceMinMs: 14000,
      patienceMaxMs: 22000,
    },
  ];

  const CAR_PREFIXES = [
    "Greasy",
    "Crooked",
    "Thunder",
    "Dented",
    "Shady",
    "Noisy",
    "Rusty",
    "Unholy",
    "Mysterious",
    "Squealing",
  ];

  const CAR_SUFFIXES = [
    "Muffler Monster",
    "Radiator Rocket",
    "Starter Goblin",
    "Oil Fountain",
    "Transmission Tragedy",
    "Alternator Drama",
    "Axle Disaster",
    "Belt Circus",
    "Fuel Pump Opera",
    "Carburetor Phantom",
  ];

  const state = {
    running: true,
    paused: false,
    shiftEnded: false,
    timeMs: 0,
    score: 0,
    highScore: 0,
    drunkMeter: 58,
    overloadReserve: 0,
    pukeRisk: 0,
    atMaxMeterMs: 0,
    pukeCooldownMs: 0,
    streakMs: 0,
    streakTier: 0,
    selectedBeerIndex: 0,
    selectedCarId: null,
    carQueue: [],
    nextCarId: 1,
    spawnTimerMs: 0,
    currentAction: null,
    event: null,
    effects: {
      steadyHandsMs: 0,
      dabRushMs: 0,
    },
    logs: [],
    settings: {
      soundOn: true,
    },
    rngSeed: 0x43f4b6d1,
  };

  const ui = {
    gameShell: document.getElementById("gameShell"),
    scoreValue: document.getElementById("scoreValue"),
    highScoreValue: document.getElementById("highScoreValue"),
    timerValue: document.getElementById("timerValue"),
    multiplierValue: document.getElementById("multiplierValue"),
    streakValue: document.getElementById("streakValue"),
    drunkMeterLabel: document.getElementById("drunkMeterLabel"),
    drunkMeterFill: document.getElementById("drunkMeterFill"),
    pukeRiskLabel: document.getElementById("pukeRiskLabel"),
    pukeRiskFill: document.getElementById("pukeRiskFill"),
    selectedCarText: document.getElementById("selectedCarText"),
    beerList: document.getElementById("beerList"),
    carQueue: document.getElementById("carQueue"),
    drinkBtn: document.getElementById("drinkBtn"),
    fixBtn: document.getElementById("fixBtn"),
    cancelRepairBtn: document.getElementById("cancelRepairBtn"),
    cigBtn: document.getElementById("cigBtn"),
    dabBtn: document.getElementById("dabBtn"),
    thingBtn: document.getElementById("thingBtn"),
    actionStatus: document.getElementById("actionStatus"),
    actionProgressFill: document.getElementById("actionProgressFill"),
    effectStatus: document.getElementById("effectStatus"),
    logFeed: document.getElementById("logFeed"),
    pauseBtn: document.getElementById("pauseBtn"),
    resetBtn: document.getElementById("resetBtn"),
    soundToggle: document.getElementById("soundToggle"),
    eventOverlay: document.getElementById("eventOverlay"),
    eventTitle: document.getElementById("eventTitle"),
    eventText: document.getElementById("eventText"),
    eventMeta: document.getElementById("eventMeta"),
    eventActionBtn: document.getElementById("eventActionBtn"),
  };

  let audioCtx = null;
  let rafId = 0;
  let lastFrameTs = performance.now();
  let accumulatorMs = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand() {
    state.rngSeed = (state.rngSeed + 0x6d2b79f5) | 0;
    let t = state.rngSeed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function randInt(min, max) {
    return Math.floor(rand() * (max - min + 1)) + min;
  }

  function pick(list) {
    return list[Math.floor(rand() * list.length)];
  }

  function weightedPick(items, weightOf) {
    const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0);
    if (total <= 0) {
      return items[0];
    }
    let roll = rand() * total;
    for (const item of items) {
      roll -= Math.max(0, weightOf(item));
      if (roll <= 0) {
        return item;
      }
    }
    return items[items.length - 1];
  }

  function formatClock(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function formatSeconds(ms) {
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function getDrunkMultiplier(meter) {
    if (meter <= 20) return 0.8;
    if (meter <= 60) return 1.0;
    if (meter <= 85) return 2.0;
    return 3.0;
  }

  function getStreakBonus() {
    if (state.streakTier <= 0) return 1;
    return clamp(1 + state.streakTier * TUNING.STREAK_STEP_MULT, 1, TUNING.STREAK_MAX_BONUS);
  }

  function addDrunk(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    const combined = state.drunkMeter + amount;
    if (combined <= 100) {
      state.drunkMeter = combined;
      return;
    }
    state.overloadReserve = clamp(state.overloadReserve + (combined - 100), 0, 200);
    state.drunkMeter = 100;
  }

  function removeDrunk(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    let remaining = amount;
    if (state.overloadReserve > 0) {
      const taken = Math.min(state.overloadReserve, remaining);
      state.overloadReserve -= taken;
      remaining -= taken;
    }
    if (remaining > 0) {
      state.drunkMeter = clamp(state.drunkMeter - remaining, 0, 100);
    }
    if (state.overloadReserve <= 0) {
      state.overloadReserve = 0;
      state.drunkMeter = clamp(state.drunkMeter, 0, 100);
    }
  }

  function ensureAudioContext() {
    if (!state.settings.soundOn) {
      return;
    }
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        return;
      }
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  }

  function playTone(kind) {
    if (!state.settings.soundOn) {
      return;
    }
    ensureAudioContext();
    if (!audioCtx) {
      return;
    }
    const table = {
      start: { type: "square", from: 220, to: 340, duration: 0.1, volume: 0.035 },
      complete: { type: "triangle", from: 350, to: 700, duration: 0.14, volume: 0.05 },
      warn: { type: "sawtooth", from: 200, to: 140, duration: 0.2, volume: 0.055 },
      puke: { type: "sawtooth", from: 130, to: 80, duration: 0.32, volume: 0.06 },
      ko: { type: "square", from: 90, to: 50, duration: 0.45, volume: 0.07 },
      tap: { type: "triangle", from: 560, to: 500, duration: 0.05, volume: 0.02 },
    };
    const cfg = table[kind] || table.start;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = cfg.type;
    osc.frequency.setValueAtTime(cfg.from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, cfg.to), now + cfg.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(cfg.volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + cfg.duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + cfg.duration + 0.02);
  }

  function addLog(text) {
    state.logs.unshift(text);
    if (state.logs.length > MAX_LOG_ENTRIES) {
      state.logs.length = MAX_LOG_ENTRIES;
    }
  }

  function loadStorage() {
    const parsedHigh = Number(localStorage.getItem(STORAGE_KEYS.highScore) || "0");
    state.highScore = Number.isFinite(parsedHigh) ? Math.max(0, Math.floor(parsedHigh)) : 0;
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || "{}");
      if (typeof parsed.soundOn === "boolean") {
        state.settings.soundOn = parsed.soundOn;
      }
    } catch (_) {
      state.settings.soundOn = true;
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
  }

  function saveHighScore() {
    localStorage.setItem(STORAGE_KEYS.highScore, String(state.highScore));
  }

  function updateHighScoreIfNeeded() {
    if (state.score > state.highScore) {
      state.highScore = state.score;
      saveHighScore();
    }
  }

  function chooseTier() {
    const unlocked = CAR_TIERS.filter((tier) => state.timeMs >= tier.unlockMs);
    const progress = clamp(state.timeMs / TUNING.RUN_DURATION_MS, 0, 1);
    return weightedPick(unlocked, (tier) => tier.weight + progress * 2.4);
  }

  function createCar() {
    const tier = chooseTier();
    const progress = clamp(state.timeMs / TUNING.RUN_DURATION_MS, 0, 1);
    const patienceScale = 1 - progress * 0.3;
    const car = {
      id: state.nextCarId++,
      name: `${pick(CAR_PREFIXES)} ${pick(CAR_SUFFIXES)}`,
      difficultyTier: tier.label,
      basePoints: randInt(tier.basePointsMin, tier.basePointsMax),
      repairTimeMs: randInt(tier.repairMinMs, tier.repairMaxMs),
      remainingRepairMs: 0,
      patienceMs: Math.floor(randInt(tier.patienceMinMs, tier.patienceMaxMs) * patienceScale),
      maxPatienceMs: 0,
    };
    car.remainingRepairMs = car.repairTimeMs;
    car.maxPatienceMs = car.patienceMs;
    return car;
  }

  function ensureSelectedCar() {
    if (state.carQueue.length === 0) {
      state.selectedCarId = null;
      return;
    }
    const stillExists = state.carQueue.some((car) => car.id === state.selectedCarId);
    if (!stillExists) {
      state.selectedCarId = state.carQueue[0].id;
    }
  }

  function spawnCar() {
    if (state.carQueue.length >= TUNING.MAX_QUEUE_SIZE) {
      return;
    }
    const car = createCar();
    state.carQueue.push(car);
    ensureSelectedCar();
  }

  function resetRun(quiet) {
    state.running = true;
    state.paused = false;
    state.shiftEnded = false;
    state.timeMs = 0;
    state.score = 0;
    state.drunkMeter = 58;
    state.overloadReserve = 0;
    state.pukeRisk = 0;
    state.atMaxMeterMs = 0;
    state.pukeCooldownMs = 0;
    state.streakMs = 0;
    state.streakTier = 0;
    state.selectedBeerIndex = 0;
    state.selectedCarId = null;
    state.carQueue.length = 0;
    state.nextCarId = 1;
    state.spawnTimerMs = 0;
    state.currentAction = null;
    state.event = null;
    state.effects.steadyHandsMs = 0;
    state.effects.dabRushMs = 0;
    state.logs.length = 0;
    state.rngSeed = (Date.now() & 0xffffffff) ^ 0x7f4a7c15;

    spawnCar();
    spawnCar();
    spawnCar();
    spawnCar();

    addLog("Bodie clocks in. The shop smells like oil and bad ideas.");
    addLog("Tip: Keep DrunkMeter between 70% and 85% to stack streak bonus.");
    if (!quiet) {
      addLog("Fresh run started. Make it weird.");
    }
  }

  function findSelectedCar() {
    return state.carQueue.find((car) => car.id === state.selectedCarId) || null;
  }

  function canStartAction() {
    return state.running && !state.paused && !state.shiftEnded && !state.currentAction && !state.event;
  }

  function startAction(payload) {
    if (!canStartAction()) {
      return false;
    }
    state.currentAction = {
      type: payload.type,
      label: payload.label,
      totalMs: payload.totalMs,
      remainingMs: payload.totalMs,
      meta: payload.meta || null,
    };
    playTone("start");
    addLog(payload.logText);
    return true;
  }

  function startRepair() {
    const car = findSelectedCar();
    if (!car) {
      addLog("No car selected. Bodie argues with a toolbox instead.");
      return;
    }
    const remaining = Math.max(600, Math.floor(car.remainingRepairMs));
    startAction({
      type: "repair",
      label: `Fixing ${car.name}`,
      totalMs: remaining,
      meta: { carId: car.id },
      logText: `Bodie dives into ${car.name}. Wrench noises intensify.`,
    });
  }

  function cancelRepair() {
    if (!state.currentAction || state.currentAction.type !== "repair") {
      return;
    }
    const action = state.currentAction;
    const car = state.carQueue.find((entry) => entry.id === action.meta.carId);
    if (car) {
      const completed = car.repairTimeMs - car.remainingRepairMs;
      const kept = completed * TUNING.REPAIR_CANCEL_KEEP_RATIO;
      car.remainingRepairMs = clamp(
        car.repairTimeMs - kept,
        Math.max(550, car.repairTimeMs * 0.25),
        car.repairTimeMs
      );
      addLog(`Repair canceled. ${Math.round((kept / car.repairTimeMs) * 100)}% progress survived.`);
    }
    state.currentAction = null;
  }

  function startDrink() {
    const beer = DRINKS[state.selectedBeerIndex];
    startAction({
      type: "drink",
      label: `Drinking ${beer.name}`,
      totalMs: beer.durationMs,
      meta: { beerId: beer.id },
      logText: `Bodie cracks a ${beer.name}.`,
    });
  }

  function startBonus(actionKey) {
    const action = BONUS_ACTIONS[actionKey];
    if (!action) return;
    startAction({
      type: "bonus",
      label: action.label,
      totalMs: action.durationMs,
      meta: { actionKey },
      logText: `Bodie starts: ${action.label.toLowerCase()}.`,
    });
  }

  function finishRepair(meta) {
    const car = state.carQueue.find((entry) => entry.id === meta.carId);
    if (!car) {
      return;
    }
    const multiplier = getDrunkMultiplier(state.drunkMeter);
    const streakBonus = getStreakBonus();
    const points = Math.round(car.basePoints * multiplier * streakBonus);
    state.score += points;
    updateHighScoreIfNeeded();

    state.carQueue = state.carQueue.filter((entry) => entry.id !== car.id);
    ensureSelectedCar();
    addLog(
      `Fixed ${car.name}: +${points} (${multiplier.toFixed(1)}x drunk x ${streakBonus.toFixed(2)} streak).`
    );
    playTone("complete");
  }

  function finishDrink(meta) {
    const beer = DRINKS.find((entry) => entry.id === meta.beerId) || DRINKS[0];
    addDrunk(beer.gain);
    state.pukeRisk = clamp(state.pukeRisk + beer.risk, 0, TUNING.PUKERISK_MAX);
    addLog(`${beer.name} hits. +${beer.gain}% DrunkMeter, +${beer.risk}% PukeRisk.`);
    playTone("complete");
  }

  function finishCigarette() {
    addDrunk(7);
    state.pukeRisk = clamp(state.pukeRisk - 12, 0, TUNING.PUKERISK_MAX);
    state.score += 45;
    state.effects.steadyHandsMs = Math.max(state.effects.steadyHandsMs, TUNING.CIG_EFFECT_MS);
    if (rand() < 0.22) {
      state.pukeRisk = clamp(state.pukeRisk + 10, 0, TUNING.PUKERISK_MAX);
      state.timeMs += 1300;
      addLog("The cigarette backfires into a cough attack. Time evaporates.");
    } else {
      addLog("Nicotine serenity: drain slowed and Bodie feels suspiciously focused.");
    }
    updateHighScoreIfNeeded();
    playTone("complete");
  }

  function finishDab() {
    addDrunk(13);
    state.pukeRisk = clamp(state.pukeRisk + 20, 0, TUNING.PUKERISK_MAX);
    state.score += 90;
    state.effects.dabRushMs = Math.max(state.effects.dabRushMs, TUNING.DAB_EFFECT_MS);
    if (rand() < 0.34) {
      state.timeMs += 2100;
      state.pukeRisk = clamp(state.pukeRisk + 14, 0, TUNING.PUKERISK_MAX);
      addLog("Dab paranoia. Bodie inspects one bolt for way too long.");
    } else {
      addLog("Dab rush active: repair speed boosted for a short window.");
    }
    updateHighScoreIfNeeded();
    playTone("complete");
  }

  function finishThing() {
    const outcomes = [
      {
        weight: 3,
        apply: () => {
          state.score += 170;
          state.pukeRisk = clamp(state.pukeRisk - 10, 0, TUNING.PUKERISK_MAX);
          addLog("Bodie finds a legendary 10mm socket under a pigeon. +170 points.");
        },
      },
      {
        weight: 3,
        apply: () => {
          state.score += 90;
          addDrunk(8);
          for (const car of state.carQueue) {
            car.patienceMs += 2200;
            car.maxPatienceMs += 2200;
          }
          addLog("Bodie tells a story so wild the customers wait longer.");
        },
      },
      {
        weight: 2,
        apply: () => {
          state.score += 130;
          addDrunk(17);
          state.pukeRisk = clamp(state.pukeRisk + 16, 0, TUNING.PUKERISK_MAX);
          addLog("Gymnastic carburetor ritual succeeds, but reality blurs.");
        },
      },
      {
        weight: 2,
        apply: () => {
          state.score = Math.max(0, state.score - 130);
          removeDrunk(10);
          state.timeMs += 2600;
          addLog("Bodie slips on a mystery puddle. Pride and points are gone.");
        },
      },
      {
        weight: 1,
        apply: () => {
          const car = findSelectedCar();
          if (!car) {
            state.score += 100;
            addLog("Bodie does a thing. Nobody knows why. +100 points anyway.");
            return;
          }
          car.remainingRepairMs = Math.max(500, car.remainingRepairMs * 0.45);
          addLog(`Arcane thing performed: ${car.name} repair progress surges.`);
        },
      },
    ];

    const chosen = weightedPick(outcomes, (entry) => entry.weight);
    chosen.apply();
    updateHighScoreIfNeeded();
    playTone("complete");
  }

  function finishBonus(meta) {
    if (meta.actionKey === "cigarette") {
      finishCigarette();
      return;
    }
    if (meta.actionKey === "dab") {
      finishDab();
      return;
    }
    if (meta.actionKey === "thing") {
      finishThing();
    }
  }

  function completeCurrentAction() {
    const action = state.currentAction;
    if (!action) {
      return;
    }
    if (action.type === "repair") {
      finishRepair(action.meta || {});
    } else if (action.type === "drink") {
      finishDrink(action.meta || {});
    } else if (action.type === "bonus") {
      finishBonus(action.meta || {});
    }
    state.currentAction = null;
  }

  function resetStreak(reasonText) {
    if (state.streakMs > 0 && reasonText) {
      addLog(reasonText);
    }
    state.streakMs = 0;
    state.streakTier = 0;
  }

  function triggerPukeEvent() {
    if (state.event || state.shiftEnded || state.paused) {
      return;
    }
    resetStreak("Streak shattered.");
    state.event = {
      type: "puke",
      timerMs: TUNING.PUKE_EVENT_MS,
      mashCount: 0,
      required: TUNING.PUKE_MASHES_REQUIRED,
    };
    state.pukeCooldownMs = TUNING.PUKERISK_COOLDOWN_MS;
    addLog("Puke warning! Mash to hold it together.");
    playTone("warn");
  }

  function resolvePukeEvent(success) {
    if (success) {
      state.score = Math.max(0, state.score - 40);
      state.timeMs += TUNING.PUKE_SUCCESS_TIME_PENALTY_MS;
      removeDrunk(13);
      state.pukeRisk = clamp(state.pukeRisk - 55, 0, TUNING.PUKERISK_MAX);
      addLog("Crisis managed. Minor dignity loss.");
      playTone("complete");
    } else {
      state.score = Math.max(0, state.score - 180);
      state.timeMs += TUNING.PUKE_FAIL_TIME_PENALTY_MS;
      removeDrunk(30);
      state.pukeRisk = clamp(state.pukeRisk - 80, 0, TUNING.PUKERISK_MAX);
      if (state.currentAction && state.currentAction.type === "repair") {
        const car = state.carQueue.find((entry) => entry.id === state.currentAction.meta.carId);
        if (car) {
          car.remainingRepairMs = clamp(
            car.remainingRepairMs + car.repairTimeMs * 0.2,
            600,
            car.repairTimeMs
          );
        }
      }
      addLog("Catastrophic puke. Massive delay.");
      playTone("puke");
    }
    updateHighScoreIfNeeded();
    state.event = null;
  }

  function mashPuke() {
    if (!state.event || state.event.type !== "puke") {
      return;
    }
    state.event.mashCount += 1;
    playTone("tap");
  }

  function triggerKO(reason) {
    if (state.event || state.shiftEnded || state.paused) {
      return;
    }
    resetStreak("Streak obliterated by KO.");
    state.event = {
      type: "ko",
      timerMs: TUNING.KO_WAKE_DELAY_MS,
      reason,
    };
    state.currentAction = null;
    addLog("Bodie hits the floor. Lights out.");
    playTone("ko");
  }

  function resolveKO() {
    state.event = null;
    state.timeMs += TUNING.KO_TIME_PENALTY_MS;
    state.drunkMeter = TUNING.KO_WAKE_METER;
    state.overloadReserve = 0;
    state.pukeRisk = TUNING.KO_WAKE_RISK;
    state.atMaxMeterMs = 0;
    state.pukeCooldownMs = Math.max(state.pukeCooldownMs, 4500);
    addLog("Bodie wakes up behind a stack of tires. Shift continues.");
  }

  function finishShift() {
    if (state.shiftEnded) {
      return;
    }
    state.running = false;
    state.paused = true;
    state.shiftEnded = true;
    state.currentAction = null;
    state.event = null;
    updateHighScoreIfNeeded();
    addLog(`Shift over. Final score: ${state.score}.`);
  }

  function updateEffects(stepMs) {
    state.effects.steadyHandsMs = Math.max(0, state.effects.steadyHandsMs - stepMs);
    state.effects.dabRushMs = Math.max(0, state.effects.dabRushMs - stepMs);
  }

  function updateStreak(stepMs) {
    const inSweetSpot =
      state.drunkMeter >= TUNING.SWEET_SPOT_MIN && state.drunkMeter <= TUNING.SWEET_SPOT_MAX;
    if (inSweetSpot) {
      state.streakMs += stepMs;
      state.streakTier = Math.floor(state.streakMs / TUNING.STREAK_STEP_MS);
    } else if (state.streakMs > 0) {
      state.streakMs = 0;
      state.streakTier = 0;
    }
  }

  function updateQueue(stepMs) {
    const progress = clamp(state.timeMs / TUNING.RUN_DURATION_MS, 0, 1);
    const spawnInterval =
      TUNING.START_SPAWN_INTERVAL_MS -
      (TUNING.START_SPAWN_INTERVAL_MS - TUNING.END_SPAWN_INTERVAL_MS) * progress;

    state.spawnTimerMs += stepMs;
    while (state.spawnTimerMs >= spawnInterval) {
      state.spawnTimerMs -= spawnInterval;
      spawnCar();
      if (state.carQueue.length >= TUNING.MAX_QUEUE_SIZE) {
        break;
      }
    }

    const activeRepairCarId =
      state.currentAction && state.currentAction.type === "repair"
        ? state.currentAction.meta.carId
        : null;

    const keep = [];
    for (const car of state.carQueue) {
      if (car.id !== activeRepairCarId) {
        car.patienceMs -= stepMs;
      }
      if (car.patienceMs <= 0) {
        addLog(`${car.name} customer rage-quits and drives away smoking.`);
        continue;
      }
      keep.push(car);
    }
    state.carQueue = keep;
    ensureSelectedCar();

    if (state.carQueue.length === 0) {
      spawnCar();
      spawnCar();
    }
  }

  function updateAction(stepMs) {
    if (!state.currentAction) {
      return;
    }
    let speed = 1;
    if (state.currentAction.type === "repair" && state.effects.dabRushMs > 0) {
      speed *= TUNING.DAB_REPAIR_SPEED_MULTIPLIER;
    }
    const delta = stepMs * speed;
    state.currentAction.remainingMs = Math.max(0, state.currentAction.remainingMs - delta);

    if (state.currentAction.type === "repair") {
      const car = state.carQueue.find((entry) => entry.id === state.currentAction.meta.carId);
      if (car) {
        car.remainingRepairMs = Math.max(0, car.remainingRepairMs - delta);
      }
    }

    if (state.currentAction.remainingMs <= 0) {
      completeCurrentAction();
    }
  }

  function updateEvent(stepMs) {
    if (!state.event) {
      return;
    }
    state.event.timerMs -= stepMs;
    if (state.event.type === "puke" && state.event.timerMs <= 0) {
      const success = state.event.mashCount >= state.event.required;
      resolvePukeEvent(success);
    } else if (state.event.type === "ko" && state.event.timerMs <= 0) {
      resolveKO();
    }
  }

  function update(stepMs) {
    if (state.shiftEnded || !state.running) {
      return;
    }
    if (state.paused) {
      return;
    }
    if (state.event) {
      updateEvent(stepMs);
      return;
    }

    state.timeMs += stepMs;
    if (state.timeMs >= TUNING.RUN_DURATION_MS) {
      state.timeMs = TUNING.RUN_DURATION_MS;
      finishShift();
      return;
    }

    const dt = stepMs / 1000;
    updateEffects(stepMs);

    let drainPerSec = TUNING.BASELINE_DRAIN_PER_SEC;
    if (state.effects.steadyHandsMs > 0) {
      drainPerSec *= TUNING.CIG_DRAIN_MULTIPLIER;
    }
    const drainAmount = drainPerSec * dt;
    if (state.overloadReserve > 0) {
      const reserveDrain = drainAmount * TUNING.OVERLOAD_DRAIN_MULTIPLIER;
      state.overloadReserve = Math.max(0, state.overloadReserve - reserveDrain);
      if (state.overloadReserve > 0) {
        state.drunkMeter = 100;
      } else {
        const spill = Math.max(0, drainAmount - reserveDrain);
        state.drunkMeter = clamp(100 - spill, 0, 100);
      }
    } else {
      state.drunkMeter = clamp(state.drunkMeter - drainAmount, 0, 100);
    }

    if (state.drunkMeter > 90) {
      state.pukeRisk = clamp(
        state.pukeRisk + TUNING.PUKERISK_GAIN_PER_SEC * dt,
        0,
        TUNING.PUKERISK_MAX
      );
    } else {
      state.pukeRisk = clamp(
        state.pukeRisk - TUNING.PUKERISK_DECAY_PER_SEC * dt,
        0,
        TUNING.PUKERISK_MAX
      );
    }

    if (state.drunkMeter >= 99.5) {
      state.atMaxMeterMs += stepMs;
    } else {
      state.atMaxMeterMs = Math.max(0, state.atMaxMeterMs - stepMs * 1.5);
    }
    state.pukeCooldownMs = Math.max(0, state.pukeCooldownMs - stepMs);

    updateStreak(stepMs);
    updateAction(stepMs);
    updateQueue(stepMs);

    if (state.atMaxMeterMs >= TUNING.KO_OVERLOAD_MS) {
      triggerKO("overloaded");
      return;
    }
    if (state.pukeRisk >= TUNING.PUKERISK_THRESHOLD && state.pukeCooldownMs <= 0) {
      triggerPukeEvent();
    }
  }

  function tick(ms) {
    accumulatorMs += ms;
    const maxCatchup = STEP_MS * 16;
    if (accumulatorMs > maxCatchup) {
      accumulatorMs = maxCatchup;
    }
    while (accumulatorMs >= STEP_MS) {
      update(STEP_MS);
      accumulatorMs -= STEP_MS;
    }
  }

  function selectBeer(index, quiet) {
    state.selectedBeerIndex = clamp(index, 0, DRINKS.length - 1);
    if (!quiet) {
      addLog(`Selected beer: ${DRINKS[state.selectedBeerIndex].name}.`);
    }
  }

  function selectCarByOffset(offset) {
    if (state.carQueue.length === 0) {
      state.selectedCarId = null;
      return;
    }
    const currentIndex = Math.max(
      0,
      state.carQueue.findIndex((entry) => entry.id === state.selectedCarId)
    );
    const next = (currentIndex + offset + state.carQueue.length) % state.carQueue.length;
    state.selectedCarId = state.carQueue[next].id;
  }

  function togglePause() {
    if (state.shiftEnded) {
      return;
    }
    if (state.event) {
      return;
    }
    state.paused = !state.paused;
    addLog(state.paused ? "Paused." : "Back to work.");
  }

  function onKeyDown(event) {
    ensureAudioContext();
    const key = event.key.toLowerCase();
    const handled = new Set([
      "1",
      "2",
      "3",
      "f",
      "d",
      "c",
      "b",
      "t",
      "p",
      "r",
      "arrowleft",
      "arrowright",
      "arrowup",
      "arrowdown",
      "enter",
      " ",
      "a",
    ]);
    if (handled.has(key)) {
      event.preventDefault();
    }

    if (state.event && state.event.type === "puke" && (key === " " || key === "enter")) {
      mashPuke();
      return;
    }

    if (key === "1") selectBeer(0, true);
    else if (key === "2") selectBeer(1, true);
    else if (key === "3") selectBeer(2, true);
    else if (key === "f" || key === "enter") startRepair();
    else if (key === "d" || key === " ") startDrink();
    else if (key === "c" || key === "a") startBonus("cigarette");
    else if (key === "b") startBonus("dab");
    else if (key === "t") startBonus("thing");
    else if (key === "arrowleft") selectBeer(state.selectedBeerIndex - 1, true);
    else if (key === "arrowright") selectBeer(state.selectedBeerIndex + 1, true);
    else if (key === "arrowup") selectCarByOffset(-1);
    else if (key === "arrowdown") selectCarByOffset(1);
    else if (key === "p") togglePause();
    else if (key === "r") resetRun(false);
  }

  function bindEvents() {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", ensureAudioContext);

    ui.pauseBtn.addEventListener("click", () => {
      ensureAudioContext();
      togglePause();
    });
    ui.resetBtn.addEventListener("click", () => resetRun(false));
    ui.soundToggle.addEventListener("click", () => {
      state.settings.soundOn = !state.settings.soundOn;
      if (state.settings.soundOn) {
        ensureAudioContext();
        playTone("start");
      }
      saveSettings();
    });
    ui.drinkBtn.addEventListener("click", () => {
      ensureAudioContext();
      startDrink();
    });
    ui.fixBtn.addEventListener("click", () => {
      ensureAudioContext();
      startRepair();
    });
    ui.cancelRepairBtn.addEventListener("click", cancelRepair);
    ui.cigBtn.addEventListener("click", () => {
      ensureAudioContext();
      startBonus("cigarette");
    });
    ui.dabBtn.addEventListener("click", () => {
      ensureAudioContext();
      startBonus("dab");
    });
    ui.thingBtn.addEventListener("click", () => {
      ensureAudioContext();
      startBonus("thing");
    });

    ui.beerList.addEventListener("click", (event) => {
      const target = event.target.closest(".beer-option");
      if (!target) return;
      const idx = Number(target.dataset.index);
      if (!Number.isFinite(idx)) return;
      selectBeer(idx, false);
    });

    ui.carQueue.addEventListener("click", (event) => {
      const target = event.target.closest(".car-card");
      if (!target) return;
      const id = Number(target.dataset.carId);
      if (!Number.isFinite(id)) return;
      state.selectedCarId = id;
    });

    ui.eventActionBtn.addEventListener("click", () => {
      if (state.event && state.event.type === "puke") {
        mashPuke();
        return;
      }
      if (state.shiftEnded) {
        resetRun(false);
        return;
      }
      if (state.paused && !state.event) {
        state.paused = false;
      }
    });
  }

  function renderBeerList() {
    const html = DRINKS
      .map((beer, index) => {
        const selected = index === state.selectedBeerIndex;
        return `
        <button
          class="beer-option ${selected ? "selected" : ""}"
          data-index="${index}"
          type="button"
          role="radio"
          aria-checked="${selected ? "true" : "false"}"
        >
          <span class="label">${beer.name}</span>
          <span class="meta">${beer.note}</span>
        </button>
      `;
      })
      .join("");
    ui.beerList.innerHTML = html;
  }

  function renderQueue() {
    if (state.carQueue.length === 0) {
      ui.carQueue.innerHTML = "<p>No cars waiting. Enjoy the silence.</p>";
      return;
    }
    const html = state.carQueue
      .map((car) => {
        const selected = car.id === state.selectedCarId;
        const active =
          state.currentAction &&
          state.currentAction.type === "repair" &&
          state.currentAction.meta.carId === car.id;
        const patiencePct = clamp((car.patienceMs / car.maxPatienceMs) * 100, 0, 100);
        const repairPct = clamp(
          ((car.repairTimeMs - car.remainingRepairMs) / car.repairTimeMs) * 100,
          0,
          100
        );
        const statusText = active
          ? `In bay: ${Math.round(repairPct)}% done`
          : `Repair ${formatSeconds(car.remainingRepairMs)} / patience ${formatSeconds(car.patienceMs)}`;
        return `
          <button
            class="car-card ${selected ? "selected" : ""}"
            type="button"
            data-car-id="${car.id}"
            role="option"
            aria-selected="${selected ? "true" : "false"}"
          >
            <div class="title">
              <span class="name">${car.name}</span>
              <span class="tier">${car.difficultyTier}</span>
            </div>
            <p class="stats">Base ${car.basePoints} pts | ${formatSeconds(car.repairTimeMs)} repair</p>
            <p class="sub">${statusText}</p>
            <div class="patience-track" aria-hidden="true">
              <div class="patience-fill" style="width:${patiencePct.toFixed(1)}%"></div>
            </div>
          </button>
        `;
      })
      .join("");
    ui.carQueue.innerHTML = html;
  }

  function renderLogs() {
    ui.logFeed.innerHTML = state.logs.map((line) => `<li><em>${line}</em></li>`).join("");
  }

  function renderActionStatus() {
    if (!state.currentAction) {
      ui.actionStatus.textContent = state.paused ? "Paused" : "Idle";
      ui.actionProgressFill.style.width = "0%";
      return;
    }
    const percent = clamp(
      ((state.currentAction.totalMs - state.currentAction.remainingMs) / state.currentAction.totalMs) * 100,
      0,
      100
    );
    ui.actionStatus.textContent = `${state.currentAction.label} (${formatSeconds(
      state.currentAction.remainingMs
    )} left)`;
    ui.actionProgressFill.style.width = `${percent.toFixed(1)}%`;
  }

  function renderEffects() {
    const effects = [];
    if (state.effects.steadyHandsMs > 0) {
      effects.push(`steady hands ${formatSeconds(state.effects.steadyHandsMs)}`);
    }
    if (state.effects.dabRushMs > 0) {
      effects.push(`dab rush ${formatSeconds(state.effects.dabRushMs)}`);
    }
    ui.effectStatus.textContent = effects.length ? `Effects: ${effects.join(" | ")}` : "Effects: none";
  }

  function renderOverlay() {
    if (state.event && state.event.type === "puke") {
      ui.eventOverlay.classList.remove("hidden");
      ui.eventTitle.textContent = "PUKE EVENT";
      ui.eventText.textContent = "Mash now. Keep it together for 2 seconds.";
      ui.eventMeta.textContent = `${state.event.mashCount}/${state.event.required} saves | ${Math.max(
        0,
        (state.event.timerMs / 1000).toFixed(2)
      )}s`;
      ui.eventActionBtn.disabled = false;
      ui.eventActionBtn.textContent = "MASH!";
      return;
    }
    if (state.event && state.event.type === "ko") {
      ui.eventOverlay.classList.remove("hidden");
      ui.eventTitle.textContent = "KNOCKED OUT";
      ui.eventText.textContent = "Bodie blacked out. Wait for wake up.";
      ui.eventMeta.textContent = `${Math.max(0, (state.event.timerMs / 1000).toFixed(1))}s`;
      ui.eventActionBtn.disabled = true;
      ui.eventActionBtn.textContent = "Out cold";
      return;
    }
    if (state.shiftEnded) {
      ui.eventOverlay.classList.remove("hidden");
      ui.eventTitle.textContent = "SHIFT COMPLETE";
      ui.eventText.textContent = `Final Score: ${state.score} | High Score: ${state.highScore}`;
      ui.eventMeta.textContent = "Press R or tap below to run it back.";
      ui.eventActionBtn.disabled = false;
      ui.eventActionBtn.textContent = "Run It Back";
      return;
    }
    if (state.paused) {
      ui.eventOverlay.classList.remove("hidden");
      ui.eventTitle.textContent = "PAUSED";
      ui.eventText.textContent = "Bodie is pretending to read service notes.";
      ui.eventMeta.textContent = "Press P or tap Resume.";
      ui.eventActionBtn.disabled = false;
      ui.eventActionBtn.textContent = "Resume";
      return;
    }
    ui.eventOverlay.classList.add("hidden");
  }

  function renderButtons() {
    const canAct = canStartAction();
    ui.fixBtn.disabled = !canAct || !findSelectedCar();
    ui.drinkBtn.disabled = !canAct;
    ui.cigBtn.disabled = !canAct;
    ui.dabBtn.disabled = !canAct;
    ui.thingBtn.disabled = !canAct;
    ui.cancelRepairBtn.disabled = !(state.currentAction && state.currentAction.type === "repair");
    ui.pauseBtn.textContent = state.paused ? "Resume (P)" : "Pause (P)";
    ui.soundToggle.textContent = state.settings.soundOn ? "Sound: On" : "Sound: Off";
    ui.soundToggle.setAttribute("aria-pressed", String(state.settings.soundOn));
  }

  function renderHUD() {
    ui.scoreValue.textContent = String(state.score);
    ui.highScoreValue.textContent = String(state.highScore);
    ui.timerValue.textContent = formatClock(TUNING.RUN_DURATION_MS - state.timeMs);
    ui.multiplierValue.textContent = `${getDrunkMultiplier(state.drunkMeter).toFixed(1)}x`;
    if (state.streakTier > 0) {
      ui.streakValue.textContent = `Tier ${state.streakTier} | ${getStreakBonus().toFixed(2)}x bonus`;
    } else {
      ui.streakValue.textContent = "Keep DrunkMeter 70-85%";
    }

    ui.drunkMeterLabel.textContent = `${state.drunkMeter.toFixed(0)}%`;
    ui.drunkMeterFill.style.width = `${state.drunkMeter.toFixed(1)}%`;
    const pukePct = clamp((state.pukeRisk / TUNING.PUKERISK_THRESHOLD) * 100, 0, 100);
    ui.pukeRiskLabel.textContent = `${state.pukeRisk.toFixed(0)}%`;
    ui.pukeRiskFill.style.width = `${pukePct.toFixed(1)}%`;

    const selected = findSelectedCar();
    ui.selectedCarText.textContent = selected
      ? `Selected car: ${selected.name} (${selected.difficultyTier})`
      : "Selected car: none";
  }

  function renderDangerVisuals() {
    const wobble = clamp((state.drunkMeter - 76) / 24, 0, 1);
    const danger = clamp(
      Math.max((state.drunkMeter - 88) / 12, state.pukeRisk / TUNING.PUKERISK_MAX),
      0,
      1
    );
    ui.gameShell.style.setProperty("--wobble-intensity", wobble.toFixed(3));
    ui.gameShell.style.setProperty("--danger-vignette", danger.toFixed(3));
    ui.gameShell.classList.toggle("is-wobbly", wobble > 0.02);
  }

  function render() {
    renderHUD();
    renderBeerList();
    renderQueue();
    renderActionStatus();
    renderEffects();
    renderButtons();
    renderLogs();
    renderOverlay();
    renderDangerVisuals();
  }

  function frame(ts) {
    const delta = Math.min(120, ts - lastFrameTs);
    lastFrameTs = ts;
    tick(delta);
    render();
    rafId = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    lastFrameTs = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function renderGameToText() {
    const payload = {
      coordinate_system:
        "UI-only state. queue_index 0 is top card. No world x/y coordinates in this game.",
      mode: state.shiftEnded
        ? "shift-ended"
        : state.paused
        ? "paused"
        : state.event
        ? state.event.type
        : "active",
      time_remaining_ms: Math.max(0, Math.round(TUNING.RUN_DURATION_MS - state.timeMs)),
      score: state.score,
      high_score: state.highScore,
      drunk_meter: Number(state.drunkMeter.toFixed(2)),
      overload_reserve: Number(state.overloadReserve.toFixed(2)),
      puke_risk: Number(state.pukeRisk.toFixed(2)),
      multiplier: getDrunkMultiplier(state.drunkMeter),
      streak_tier: state.streakTier,
      streak_bonus: Number(getStreakBonus().toFixed(2)),
      selected_beer: DRINKS[state.selectedBeerIndex].name,
      selected_car_id: state.selectedCarId,
      current_action: state.currentAction
        ? {
            type: state.currentAction.type,
            label: state.currentAction.label,
            remaining_ms: Math.round(state.currentAction.remainingMs),
          }
        : null,
      event:
        state.event && state.event.type === "puke"
          ? {
              type: "puke",
              remaining_ms: Math.round(state.event.timerMs),
              mash_count: state.event.mashCount,
              required: state.event.required,
            }
          : state.event
          ? {
              type: state.event.type,
              remaining_ms: Math.round(state.event.timerMs),
            }
          : null,
      queue: state.carQueue.map((car, index) => ({
        queue_index: index,
        id: car.id,
        name: car.name,
        tier: car.difficultyTier,
        base_points: car.basePoints,
        repair_remaining_ms: Math.round(car.remainingRepairMs),
        patience_remaining_ms: Math.round(car.patienceMs),
      })),
      recent_logs: state.logs.slice(0, 6),
    };
    return JSON.stringify(payload, null, 2);
  }

  function advanceTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    tick(ms);
    render();
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = advanceTime;

  loadStorage();
  resetRun(true);
  bindEvents();
  startLoop();
  render();
})();
