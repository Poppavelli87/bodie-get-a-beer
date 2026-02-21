(() => {
  "use strict";

  const STORAGE_KEYS = {
    highScore: "bodie_get_a_beer_high_score",
    settings: "bodie_get_a_beer_settings",
  };

  const STEP_MS = 1000 / 60;
  const MAX_LOG_ENTRIES = 30;

  const TUNING = {
    // === Shift pacing and scoring ===
    RUN_DURATION_MS: 3 * 60 * 1000,
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
    KO_WAKE_DELAY_MS: 3200,
    KO_TIME_PENALTY_MS: 6500,
    KO_WAKE_RISK: 20,
    PUKE_EVENT_MS: 2000,
    PUKE_MASHES_REQUIRED: 17,
    PUKE_FAIL_TIME_PENALTY_MS: 5200,
    PUKE_SUCCESS_TIME_PENALTY_MS: 1800,
    MAX_QUEUE_SIZE: 7,
    START_SPAWN_INTERVAL_MS: 6800,
    END_SPAWN_INTERVAL_MS: 3000,
    REPAIR_CANCEL_KEEP_RATIO: 0.45,

    // === Intoxication model (v1.1) ===
    BAC_BASE_DECAY_PER_SEC: 0.044,
    BAC_REPAIR_DECAY_BONUS_PER_SEC: 0.014,
    BAC_HYDRATION_DECAY_BONUS_PER_SEC: 0.012,
    BAC_CIG_DECAY_MULTIPLIER: 0.68,
    BAC_DAB_DECAY_MULTIPLIER: 0.9,
    DRUNK_CURVE_DENOMINATOR: 1.2,
    DRUNK_CURVE_POWER: 0.75,
    PUKE_HIGH_METER_THRESHOLD: 92,
    PUKE_HIGH_METER_GRACE_MS: 2500,
    PUKE_HIGH_METER_GAIN_PER_SEC: 9,
    PUKE_OVERLOAD_BAC_THRESHOLD: 1.25,
    PUKE_OVERLOAD_GAIN_PER_SEC: 28,
    PUKE_UNDER_CONTROL_THRESHOLD: 85,
    PUKE_UNDER_CONTROL_DECAY_PER_SEC: 13,
    KO_BAC_THRESHOLD: 1.45,
    KO_BAC_OVERLOAD_WINDOW_MS: 1500,
    KO_RANDOM_BAC_THRESHOLD: 1.36,
    KO_RANDOM_CHANCE_PER_SEC: 0.08,
    HANGOVER_CRASH_MS: 10000,
    HANGOVER_REPAIR_SPEED_MULTIPLIER: 0.62,
    KO_WAKE_BAC: 0.64,
    FLOW_BUILD_PER_SEC: 0.1,
    FLOW_DECAY_PER_SEC: 0.16,
    FLOW_REPAIR_SPEED_MAX_BONUS: 0.22,
    FLOW_STREAK_MAX_BONUS: 0.16,
    FLOW_DECAY_REDUCTION_MAX: 0.18,

    // === Legacy bonus effects ===
    CIG_EFFECT_MS: 12000,
    DAB_EFFECT_MS: 11000,
    DAB_REPAIR_SPEED_MULTIPLIER: 1.3,
    MYSTERY_GOD_MODE_MS: 5500,
    MYSTERY_REPAIR_SPEED_MULTIPLIER: 1.45,
  };

  const DRINKS = [
    {
      id: "light",
      name: "Light Beer",
      bacGain: 0.18,
      risk: 3,
      durationMs: 1700,
      note: "+0.18 BAC / low risk",
    },
    {
      id: "tallboy",
      name: "Tallboy",
      bacGain: 0.31,
      risk: 8,
      durationMs: 2600,
      note: "+0.31 BAC / medium risk",
    },
    {
      id: "craftipa",
      name: "Craft IPA",
      bacGain: 0.42,
      risk: 13,
      durationMs: 3200,
      note: "+0.42 BAC / wobbly",
    },
    {
      id: "mystery",
      name: "Mystery Gas Station Beer",
      bacGain: 0.68,
      risk: 30,
      durationMs: 2000,
      note: "+0.68 BAC / chaos mode",
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


  const REPAIR_STYLE_BY_TIER = {
    "Backyard Beater": ["repairing_pour", "repairing_hammer", "repairing_wrench"],
    "Soccer Van": ["repairing_wrench", "repairing_pour", "repairing_wiring"],
    "Turbo Coupe": ["repairing_wrench", "repairing_wiring", "repairing_hammer"],
    "Cursed Diesel": ["repairing_pour", "repairing_wrench", "repairing_hammer"],
    "Midnight Racecar": ["repairing_wiring", "repairing_wrench", "repairing_hammer"],
  };

  const DIRT_STAGE_LABELS = [
    "Clean-ish human",
    "Lightly smudged",
    "Greasy technician",
    "Oil-splattered",
    "Full shop goblin",
    "Sentient oil slick",
  ];

  const DIRT_STAGE_CAPTIONS = [
    "Bodie gains +1% viscosity.",
    "That’s not a shirt anymore. That’s a rag with dreams.",
    "EPA has entered the chat.",
    "OSHA is pretending this is performance art.",
    "He no longer casts a shadow, just a slick.",
  ];

  const state = {
    running: true,
    paused: false,
    shiftEnded: false,
    timeMs: 0,
    score: 0,
    highScore: 0,
    drunkMeter: 58,
    bac: 0.66,
    hydration: 0.5,
    tolerance: 0,
    pukeRisk: 0,
    highDrunkMs: 0,
    bacOverloadMs: 0,
    pukeCooldownMs: 0,
    flow: 0,
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
      mysteryRushMs: 0,
      hangoverCrashMs: 0,
    },
    bodie: {
      mode: "idle",
      modeUntil: 0,
      caption: "Precision requires carbonation.",
      overlayMode: "none",
      overlayUntil: 0,
      dirt: 0,
      dishevelLevel: 0,
      foamUntil: 0,
      repairIntensity: 0,
    },
    logs: [],
    settings: {
      soundOn: true,
      compactMode: "auto",
      autoPauseOnPortrait: true,
      mobile3PanelLayout: true,
      leftHanded: false,
    },
    rngSeed: 0x43f4b6d1,
    uiPanels: { queueOpen: true, actionOpen: true, logOpen: false, initialized: false },
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
    bodieStage: document.getElementById("bodieStage"),
    bodieCaption: document.getElementById("bodieCaption"),
    bodieOilMeter: document.getElementById("bodieOilMeter"),
    compactModeToggle: document.getElementById("compactModeToggle"),
    mobileLayoutToggle: document.getElementById("mobileLayoutToggle"),
    portraitPauseToggle: document.getElementById("portraitPauseToggle"),
    actionPauseBtn: document.getElementById("actionPauseBtn"),
    layoutIndicator: document.getElementById("layoutIndicator"),
    rotateOverlay: document.getElementById("rotateOverlay"),
    mobileNowDoing: document.getElementById("mobileNowDoing"),
    mobileActionText: document.getElementById("mobileActionText"),
    mobileCarText: document.getElementById("mobileCarText"),
    mobileMultiplierText: document.getElementById("mobileMultiplierText"),
    queuePanel: document.getElementById("queuePanel"),
    stagePanel: document.getElementById("stagePanel"),
    stagePanelSlot: document.getElementById("stagePanelSlot"),
    actionPanel: document.getElementById("actionPanel"),
    logPanel: document.getElementById("logPanel"),
    queuePanelToggle: document.getElementById("queuePanelToggle"),
    actionPanelToggle: document.getElementById("actionPanelToggle"),
    logPanelToggle: document.getElementById("logPanelToggle"),
    actionDock: document.getElementById("actionDock"),
    mobileBeerSegment: document.getElementById("mobileBeerSegment"),
    dockDrinkBtn: document.getElementById("dockDrinkBtn"),
    dockFixBtn: document.getElementById("dockFixBtn"),
    dockCigBtn: document.getElementById("dockCigBtn"),
    dockDabBtn: document.getElementById("dockDabBtn"),
    dockThingBtn: document.getElementById("dockThingBtn"),
    dockPauseBtn: document.getElementById("dockPauseBtn"),
    dockSelectedCar: document.getElementById("dockSelectedCar"),
    mobileCarQuickSelect: document.getElementById("mobileCarQuickSelect"),
    mobileArena: document.getElementById("mobileArena"),
    mobilePanelLeft: document.getElementById("mobilePanelLeft"),
    mobilePanelCenter: document.getElementById("mobilePanelCenter"),
    mobilePanelRight: document.getElementById("mobilePanelRight"),
    gameCanvas: document.getElementById("gameCanvas"),
    leftPadCanvas: document.getElementById("leftPadCanvas"),
    mobilePauseBtn: document.getElementById("mobilePauseBtn"),
    mobileJumpBtn: document.getElementById("mobileJumpBtn"),
    mobileSpecialBtn: document.getElementById("mobileSpecialBtn"),
    leftHandToggle: document.getElementById("leftHandToggle"),
    rotateHintCanvas: document.getElementById("rotateHintCanvas"),
    mobileHeartsHud: document.getElementById("mobileHeartsHud"),
    mobileBaconHud: document.getElementById("mobileBaconHud"),
    mobileLevelHud: document.getElementById("mobileLevelHud"),
  };

  let currentLayout = "desktop";
  let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let autoPausedByVisibility = false;
  let autoPausedByRotateGate = false;
  let stageGroupPlaceholder = null;
  let actionStatusPlaceholder = null;
  let logPanelPlaceholder = null;
  let lastQueueSignature = "";
  let lastLogSignature = "";
  let audioCtx = null;
  let rafId = 0;
  let lastFrameTs = performance.now();
  let accumulatorMs = 0;
  let lastRotateOverlayFrame = 0;

  const BASE_W = 960;
  const BASE_H = 540;
  const mobileRender = {
    dpr: 1,
    leftPanelW: 180,
    rightPanelW: 180,
    centerX: 180,
    centerW: 600,
    centerH: 540,
    scale: 1,
    gameOffsetX: 180,
    gameOffsetY: 0,
  };

  const touchState = {
    leftHanded: false,
    joystick: { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0 },
    rightTouches: new Map(),
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isTouchDevice() {
    return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  }

  function isProbablyMobileUA() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  }

  function isLandscapeOrientation() {
    if (window.screen?.orientation?.type) {
      return window.screen.orientation.type.includes("landscape");
    }
    return window.matchMedia("(orientation: landscape)").matches;
  }

  function isSmallViewport() {
    const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    return Math.min(vw, vh) < 800;
  }

  function isMobileDevice() {
    return (window.matchMedia("(pointer: coarse)").matches || isProbablyMobileUA()) && isSmallViewport();
  }

  function isMobileLayout() {
    return currentLayout !== "desktop";
  }

  function isPortraitBlockedLayout() {
    return currentLayout === "mobilePortraitBlocked";
  }

  function getCompactModeEnabled() {
    if (state.settings.compactMode === "on") return true;
    if (state.settings.compactMode === "off") return false;
    return isSmallViewport();
  }

  function moveStageBlocksIntoMobilePanel(enableMobileStage) {
    const bodieGroup = ui.actionPanel.querySelector(".bodie-group");
    const actionStatusGroup = ui.actionStatus ? ui.actionStatus.closest(".action-group") : null;
    if (!bodieGroup || !actionStatusGroup) {
      return;
    }
    if (enableMobileStage) {
      if (!stageGroupPlaceholder) {
        stageGroupPlaceholder = document.createComment("bodie-group-placeholder");
        bodieGroup.parentNode.insertBefore(stageGroupPlaceholder, bodieGroup);
      }
      if (!actionStatusPlaceholder) {
        actionStatusPlaceholder = document.createComment("action-status-placeholder");
        actionStatusGroup.parentNode.insertBefore(actionStatusPlaceholder, actionStatusGroup);
      }
      if (!logPanelPlaceholder) {
        logPanelPlaceholder = document.createComment("log-panel-placeholder");
        ui.logPanel.parentNode.insertBefore(logPanelPlaceholder, ui.logPanel);
      }
      if (bodieGroup.parentNode !== ui.stagePanelSlot) {
        ui.stagePanelSlot.appendChild(ui.mobileNowDoing);
        ui.stagePanelSlot.appendChild(bodieGroup);
        ui.stagePanelSlot.appendChild(actionStatusGroup);
      }
      if (ui.logPanel.parentNode !== ui.actionPanel) {
        ui.actionPanel.appendChild(ui.logPanel);
      }
      return;
    }
    if (stageGroupPlaceholder?.parentNode && bodieGroup.parentNode !== stageGroupPlaceholder.parentNode) {
      stageGroupPlaceholder.parentNode.insertBefore(bodieGroup, stageGroupPlaceholder.nextSibling);
    }
    if (actionStatusPlaceholder?.parentNode && actionStatusGroup.parentNode !== actionStatusPlaceholder.parentNode) {
      actionStatusPlaceholder.parentNode.insertBefore(actionStatusGroup, actionStatusPlaceholder.nextSibling);
    }
    if (logPanelPlaceholder?.parentNode && ui.logPanel.parentNode !== logPanelPlaceholder.parentNode) {
      logPanelPlaceholder.parentNode.insertBefore(ui.logPanel, logPanelPlaceholder.nextSibling);
    }
    if (ui.mobileNowDoing.parentNode !== ui.gameShell) {
      ui.gameShell.insertBefore(ui.mobileNowDoing, ui.gameShell.querySelector(".hud-grid"));
    }
  }

  function detectLayout() {
    const vw = window.visualViewport ? Math.round(window.visualViewport.width) : window.innerWidth;
    const vh = window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight;
    const mobile = isMobileDevice();
    const landscape = isLandscapeOrientation();
    if (!mobile) {
      currentLayout = "desktop";
    } else {
      currentLayout = landscape && state.settings.mobile3PanelLayout ? "mobileLandscape3" : landscape ? "desktop" : "mobilePortraitBlocked";
    }

    const isRotateBlocked = currentLayout === "mobilePortraitBlocked";
    if (isRotateBlocked && state.settings.autoPauseOnPortrait && !state.paused && !state.shiftEnded && !state.event) {
      state.paused = true;
      autoPausedByRotateGate = true;
      if (audioCtx && audioCtx.state === "running") {
        audioCtx.suspend().catch(() => {});
      }
      addLog("Auto-paused in portrait. Bodie needs landscape.");
    } else if (!isRotateBlocked && autoPausedByRotateGate && !state.shiftEnded && !state.event) {
      state.paused = false;
      autoPausedByRotateGate = false;
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      addLog("Landscape restored. Back to wrenching.");
    }

    if (!isRotateBlocked) {
      autoPausedByRotateGate = false;
    }

    document.body.dataset.layout = currentLayout;
    document.body.dataset.touch = String(isTouchDevice());
    document.body.dataset.rotateBlocked = String(isRotateBlocked);
    document.body.dataset.mobileEffects = mobile ? "reduced" : "full";
    document.body.dataset.compact = String(getCompactModeEnabled());
    document.body.dataset.leftHanded = String(touchState.leftHanded);
    ui.rotateOverlay.setAttribute("aria-hidden", String(!isRotateBlocked));
    ui.layoutIndicator.textContent = `Landscape Mode: ${currentLayout === "desktop" ? "Desktop" : isRotateBlocked ? "Rotate Required" : "Mobile 3-Panel"}`;
    moveStageBlocksIntoMobilePanel(currentLayout === "mobileLandscape3");
    computeMobileLayout(vw, vh);
  }

  function computeMobileLayout(vw, vh) {
    if (!ui.gameCanvas) return;
    const W = vw || window.innerWidth;
    const H = vh || window.innerHeight;
    const leftPanelW = clamp(W * 0.22, 140, 260);
    const rightPanelW = clamp(W * 0.22, 140, 260);
    const centerW = Math.max(220, W - leftPanelW - rightPanelW);
    const centerH = H;
    const centerX = touchState.leftHanded ? rightPanelW : leftPanelW;
    const scale = Math.min(centerW / BASE_W, centerH / BASE_H);
    const gameOffsetX = centerX + (centerW - BASE_W * scale) / 2;
    const gameOffsetY = (centerH - BASE_H * scale) / 2;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    Object.assign(mobileRender, { dpr, leftPanelW, rightPanelW, centerW, centerH, centerX, scale, gameOffsetX, gameOffsetY });

    ui.gameCanvas.width = Math.floor(W * dpr);
    ui.gameCanvas.height = Math.floor(H * dpr);
    ui.gameCanvas.style.width = `${W}px`;
    ui.gameCanvas.style.height = `${H}px`;

    if (ui.leftPadCanvas) {
      const side = Math.floor(Math.min(leftPanelW - 24, H * 0.55));
      ui.leftPadCanvas.width = Math.max(160, side * dpr);
      ui.leftPadCanvas.height = Math.max(160, side * dpr);
      ui.leftPadCanvas.style.width = `${Math.max(160, side)}px`;
      ui.leftPadCanvas.style.height = `${Math.max(160, side)}px`;
    }

    document.documentElement.style.setProperty("--left-panel-w", `${Math.round(leftPanelW)}px`);
    document.documentElement.style.setProperty("--right-panel-w", `${Math.round(rightPanelW)}px`);
  }

  function vibratePulse(ms) {
    if (reduceMotion || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(ms);
  }

  function renderRotateHint(ts = performance.now()) {
    if (!ui.rotateHintCanvas) return;
    const ctx = ui.rotateHintCanvas.getContext("2d");
    if (!ctx) return;
    const w = ui.rotateHintCanvas.width;
    const h = ui.rotateHintCanvas.height;
    const t = ts * 0.002;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.arc(w/2, h/2, 70, 0, Math.PI*2);
    ctx.fill();
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(Math.sin(t) * 0.8);
    ctx.fillStyle = "#f5d7a4";
    ctx.fillRect(-22, -36, 44, 72);
    ctx.clearRect(-16, -29, 32, 50);
    ctx.restore();
    ctx.strokeStyle = "#f5d7a4";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w/2, h/2, 56, -0.5, 1.8);
    ctx.stroke();
  }

  function renderMobileCanvas() {
    if (!ui.gameCanvas || currentLayout !== "mobileLandscape3") return;
    const ctx = ui.gameCanvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const { dpr, leftPanelW, rightPanelW, centerX, centerW, centerH, scale, gameOffsetX, gameOffsetY } = mobileRender;
    const W = ui.gameCanvas.width / dpr;
    const H = ui.gameCanvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);

    const leftX = touchState.leftHanded ? W - leftPanelW : 0;
    const rightX = touchState.leftHanded ? 0 : W - rightPanelW;

    const leftGrad = ctx.createLinearGradient(leftX, 0, leftX + leftPanelW, H);
    leftGrad.addColorStop(0, "#4e3220"); leftGrad.addColorStop(1, "#2d2017");
    ctx.fillStyle = leftGrad; ctx.fillRect(leftX, 0, leftPanelW, H);
    const rightGrad = ctx.createLinearGradient(rightX, 0, rightX + rightPanelW, H);
    rightGrad.addColorStop(0, "#2a2635"); rightGrad.addColorStop(1, "#1b1a24");
    ctx.fillStyle = rightGrad; ctx.fillRect(rightX, 0, rightPanelW, H);

    ctx.fillStyle = "#121a24";
    ctx.fillRect(centerX, 0, centerW, centerH);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(centerX, 0, 2, H);
    ctx.fillRect(centerX + centerW - 2, 0, 2, H);

    ctx.save();
    ctx.beginPath();
    ctx.rect(centerX, 0, centerW, centerH);
    ctx.clip();
    ctx.fillStyle = "#1e2d3b";
    ctx.fillRect(centerX, 0, centerW, centerH);

    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, gameOffsetX * dpr, gameOffsetY * dpr);
    ctx.fillStyle = "#2e78d1";
    ctx.fillRect(0, 0, BASE_W, BASE_H);
    ctx.fillStyle = "#7cb4ff";
    for (let i = 0; i < 14; i += 1) ctx.fillRect((i * 72 + (state.timeMs * 0.03) % 72), 80 + (i % 3) * 32, 22, 10);
    ctx.fillStyle = "#f4efe2";
    ctx.fillRect(80 + (state.timeMs * 0.12) % 700, 340, 80, 80);
    ctx.restore();
  }

  function renderJoystickPad() {
    if (!ui.leftPadCanvas || currentLayout !== "mobileLandscape3") return;
    const ctx = ui.leftPadCanvas.getContext("2d");
    if (!ctx) return;
    const w = ui.leftPadCanvas.width;
    const h = ui.leftPadCanvas.height;
    const centerX = touchState.joystick.active ? touchState.joystick.baseX : w * 0.5;
    const centerY = touchState.joystick.active ? touchState.joystick.baseY : h * 0.62;
    const radius = Math.min(w, h) * 0.22;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(20,20,26,0.35)";
    ctx.beginPath(); ctx.arc(centerX, centerY, radius * 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,226,164,0.35)";
    ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath(); ctx.arc(centerX + touchState.joystick.dx, centerY + touchState.joystick.dy, radius * 0.45, 0, Math.PI * 2); ctx.fill();
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
    const flowStreakBoost = 1 + state.flow * TUNING.FLOW_STREAK_MAX_BONUS;
    return (
      clamp(1 + state.streakTier * TUNING.STREAK_STEP_MULT, 1, TUNING.STREAK_MAX_BONUS) * flowStreakBoost
    );
  }

  function syncDrunkFromBac() {
    const ratio = clamp(state.bac / TUNING.DRUNK_CURVE_DENOMINATOR, 0, 1);
    state.drunkMeter = Math.pow(ratio, TUNING.DRUNK_CURVE_POWER) * 100;
  }

  function addBac(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    state.bac = clamp(state.bac + amount, 0, 1.5);
    state.tolerance = clamp(state.tolerance + amount * 0.045, 0, 1);
    state.hydration = clamp(state.hydration - amount * 0.08, 0, 1);
    syncDrunkFromBac();
  }

  function removeBac(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    state.bac = clamp(state.bac - amount, 0, 1.5);
    state.hydration = clamp(state.hydration + amount * 0.2, 0, 1);
    syncDrunkFromBac();
  }


  function getDisheveledLevel() {
    if (state.bac < 0.35) return 0;
    if (state.bac < 0.6) return 1;
    if (state.bac < 0.85) return 2;
    if (state.bac < 1.08) return 3;
    if (state.bac < 1.3) return 4;
    return 5;
  }

  function getDirtStage(dirt) {
    if (dirt <= 10) return 0;
    if (dirt <= 25) return 1;
    if (dirt <= 45) return 2;
    if (dirt <= 65) return 3;
    if (dirt <= 85) return 4;
    return 5;
  }

  function addDirt(amount, reason) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const previousStage = getDirtStage(state.bodie.dirt);
    state.bodie.dirt = clamp(state.bodie.dirt + amount, 0, 100);
    const nextStage = getDirtStage(state.bodie.dirt);
    if (nextStage > previousStage) {
      const captionIndex = Math.min(DIRT_STAGE_CAPTIONS.length - 1, nextStage - 1);
      addLog(DIRT_STAGE_CAPTIONS[captionIndex]);
      if (reason) {
        addLog(reason);
      }
    }
  }

  function getRepairStyleForCar(car) {
    if (!car) return "repairing_wrench";
    const tierStyles = REPAIR_STYLE_BY_TIER[car.difficultyTier] || ["repairing_wrench"];
    const style = tierStyles[randInt(0, tierStyles.length - 1)];
    if (car.name.includes("Oil") || car.name.includes("Radiator")) return "repairing_pour";
    if (car.name.includes("Alternator") || car.name.includes("Starter")) return "repairing_wiring";
    if (car.name.includes("Muffler") || car.name.includes("Axle")) return "repairing_wrench";
    if (car.name.includes("Phantom") || car.name.includes("Goblin")) return "repairing_hammer";
    return style;
  }

  function getRepairDirtGain(car) {
    const nudge = car.repairStyle === "repairing_hammer" ? 2 : car.repairStyle === "repairing_pour" ? 1 : 0;
    if (car.difficultyTier === "Backyard Beater") return clamp(randInt(4, 7) + nudge, 4, 7);
    if (car.difficultyTier === "Soccer Van" || car.difficultyTier === "Turbo Coupe") return clamp(randInt(7, 12) + nudge, 7, 12);
    return clamp(randInt(12, 20) + nudge, 12, 20);
  }

  function updateBodieAppearance() {
    state.bodie.dishevelLevel = getDisheveledLevel();
    const dirtStage = getDirtStage(state.bodie.dirt);
    if (!ui.bodieStage) return;
    ui.bodieStage.dataset.dirtStage = String(dirtStage);
    ui.bodieStage.dataset.dishevel = String(state.bodie.dishevelLevel);
    ui.bodieStage.style.setProperty("--dirt-level", String(dirtStage));
    ui.bodieStage.style.setProperty("--dishevel-level", String(state.bodie.dishevelLevel));
    ui.bodieStage.classList.remove("dirt-0", "dirt-1", "dirt-2", "dirt-3", "dirt-4", "dirt-5");
    ui.bodieStage.classList.add(`dirt-${dirtStage}`);
    if (ui.bodieOilMeter) {
      ui.bodieOilMeter.textContent = `🛢️ ${DIRT_STAGE_LABELS[dirtStage]}`;
    }
  }

  function setBodieMode(mode, durationMs, captionPool) {
    const now = state.timeMs;
    state.bodie.mode = mode;
    state.bodie.modeUntil = now + Math.max(0, durationMs || 0);
    if (Array.isArray(captionPool) && captionPool.length) {
      state.bodie.caption = pick(captionPool);
    }
  }

  function setBodieOverlay(mode, durationMs) {
    state.bodie.overlayMode = mode;
    state.bodie.overlayUntil = state.timeMs + Math.max(0, durationMs || 0);
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

  function animateTapFeedback(button) {
    if (!button) return;
    button.classList.remove("tap-feedback");
    button.offsetWidth;
    button.classList.add("tap-feedback");
    setTimeout(() => button.classList.remove("tap-feedback"), 130);
    if (state.settings.soundOn) {
      playTone("tap");
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
      if (typeof parsed.autoPauseOnPortrait === "boolean") {
        state.settings.autoPauseOnPortrait = parsed.autoPauseOnPortrait;
      }
      if (["auto", "on", "off"].includes(parsed.compactMode)) {
        state.settings.compactMode = parsed.compactMode;
      }
      if (typeof parsed.mobile3PanelLayout === "boolean") {
        state.settings.mobile3PanelLayout = parsed.mobile3PanelLayout;
      }
      if (typeof parsed.leftHanded === "boolean") {
        state.settings.leftHanded = parsed.leftHanded;
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
    car.repairStyle = getRepairStyleForCar(car);
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
    state.bac = 0.66;
    state.hydration = 0.5;
    state.tolerance = 0;
    state.pukeRisk = 0;
    state.highDrunkMs = 0;
    state.bacOverloadMs = 0;
    state.pukeCooldownMs = 0;
    state.flow = 0;
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
    state.effects.mysteryRushMs = 0;
    state.effects.hangoverCrashMs = 0;
    state.logs.length = 0;
    state.rngSeed = (Date.now() & 0xffffffff) ^ 0x7f4a7c15;
    syncDrunkFromBac();
    state.bodie.mode = "idle";
    state.bodie.modeUntil = 0;
    state.bodie.overlayMode = "none";
    state.bodie.overlayUntil = 0;
    state.bodie.caption = "Precision requires carbonation.";
    state.bodie.dirt = 0;
    state.bodie.dishevelLevel = 0;
    state.bodie.foamUntil = 0;
    state.bodie.repairIntensity = 0;
    lastQueueSignature = "";
    lastLogSignature = "";

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
    return state.running && !state.paused && !state.shiftEnded && !state.currentAction && !state.event && !isPortraitBlockedLayout();
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
    car.repairStyle = car.repairStyle || getRepairStyleForCar(car);
    const styleLabel = car.repairStyle.replace("repairing_", "");
    const started = startAction({
      type: "repair",
      label: `Fixing ${car.name} (${styleLabel})`,
      totalMs: remaining,
      meta: { carId: car.id, repairStyle: car.repairStyle },
      logText: `Bodie dives into ${car.name}. ${styleLabel} protocol engaged.`,
    });
    if (started) {
      const captionByStyle = {
        repairing_wrench: ["This bolt fears me.", "Wrench therapy in session.", "Torque is just jazz."],
        repairing_pour: ["Everything is better with mystery fluid.", "Pour now, ask torque specs later."],
        repairing_hammer: ["Percussive maintenance is still maintenance.", "If it dings, it lives."],
        repairing_wiring: ["Electricity is just spicy spaghetti.", "Wire colors are a suggestion."],
      };
      setBodieMode(car.repairStyle, remaining, captionByStyle[car.repairStyle] || captionByStyle.repairing_wrench);
    }
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
    state.bodie.repairIntensity = 0;
  }

  function startDrink() {
    const beer = DRINKS[state.selectedBeerIndex];
    const started = startAction({
      type: "drink",
      label: `Drinking ${beer.name}`,
      totalMs: beer.durationMs,
      meta: { beerId: beer.id },
      logText: `Bodie cracks a ${beer.name}.`,
    });
    if (started) {
      setBodieMode("drinking", beer.durationMs, ["Precision requires carbonation.", "Hydraulics run on vibes.", "One sip per horsepower."]);
    }
  }

  function startBonus(actionKey) {
    const action = BONUS_ACTIONS[actionKey];
    if (!action) return;
    const started = startAction({
      type: "bonus",
      label: action.label,
      totalMs: action.durationMs,
      meta: { actionKey },
      logText: `Bodie starts: ${action.label.toLowerCase()}.`,
    });
    if (!started) return;
    if (actionKey === "cigarette") {
      setBodieMode("cigarette", action.durationMs + 2400, ["Shop smoke break diplomacy.", "Stress exits through the ember."]);
    } else if (actionKey === "dab") {
      setBodieMode("dab", action.durationMs + 3200, ["That dab hit the timeline.", "I can hear colors in this engine."]);
      setBodieOverlay("timewarp", 1500);
    } else {
      setBodieMode("repairing_hammer", action.durationMs, ["Questionable mechanics activated.", "If it works, it was intentional."]);
    }
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

    const dirtGain = getRepairDirtGain(car);
    addDirt(dirtGain);

    if (state.bodie.dirt >= 80 && state.drunkMeter >= 85) {
      state.score += 33;
      addLog("Grease wizard bonus: +33 style points.");
    }

    state.carQueue = state.carQueue.filter((entry) => entry.id !== car.id);
    ensureSelectedCar();
    addLog(
      `Fixed ${car.name}: +${points} (${multiplier.toFixed(1)}x drunk x ${streakBonus.toFixed(2)} streak).`
    );
    addLog(`Motor oil everywhere. Dirt +${dirtGain}.`);
    playTone("complete");
  }

  function finishDrink(meta) {
    const beer = DRINKS.find((entry) => entry.id === meta.beerId) || DRINKS[0];
    addBac(beer.bacGain);
    state.pukeRisk = clamp(state.pukeRisk + beer.risk * (1 - state.tolerance * 0.22), 0, TUNING.PUKERISK_MAX);
    state.bodie.foamUntil = state.timeMs + 2000;
    if (beer.id === "mystery") {
      state.effects.mysteryRushMs = Math.max(state.effects.mysteryRushMs, TUNING.MYSTERY_GOD_MODE_MS);
      addLog(`${beer.name} detonates your senses. God mode... probably.`);
    } else {
      addLog(`${beer.name} hits. +${beer.bacGain.toFixed(2)} BAC, +${beer.risk}% PukeRisk.`);
    }
    playTone("complete");
  }

  function finishCigarette() {
    addBac(0.05);
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
    addBac(0.09);
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
          addBac(0.06);
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
          addBac(0.12);
          state.pukeRisk = clamp(state.pukeRisk + 16, 0, TUNING.PUKERISK_MAX);
          addLog("Gymnastic carburetor ritual succeeds, but reality blurs.");
        },
      },
      {
        weight: 2,
        apply: () => {
          state.score = Math.max(0, state.score - 130);
          removeBac(0.1);
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
    state.bodie.repairIntensity = 0;
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
    setBodieMode("puke", 1800, ["Nope nope nope.", "Containment breach in progress."]);
    setBodieOverlay("puke", 1400);
    addDirt(randInt(2, 5));
    addLog("Puke warning! Mash to hold it together.");
    playTone("warn");
  }

  function resolvePukeEvent(success) {
    if (success) {
      state.score = Math.max(0, state.score - 40);
      state.timeMs += TUNING.PUKE_SUCCESS_TIME_PENALTY_MS;
      removeBac(0.16);
      state.pukeRisk = clamp(state.pukeRisk - 55, 0, TUNING.PUKERISK_MAX);
      addLog("Crisis managed. Minor dignity loss.");
      playTone("complete");
    } else {
      state.score = Math.max(0, state.score - 180);
      state.timeMs += TUNING.PUKE_FAIL_TIME_PENALTY_MS;
      removeBac(0.42);
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
      addDirt(randInt(4, 8), "Embarrassment residue added.");
      addLog("Catastrophic puke. Massive delay.");
      setBodieMode("puke", 2400, ["The floor did not deserve this."]);
      setBodieOverlay("puke", 1800);
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
    addDirt(randInt(5, 9), "KO nap in a puddle. Extra grime acquired.");
    setBodieMode("ko", TUNING.KO_WAKE_DELAY_MS + 800, ["Tell my sockets I love them."]);
    addLog("Bodie hits the floor. Lights out.");
    playTone("ko");
  }

  function resolveKO() {
    state.event = null;
    state.timeMs += TUNING.KO_TIME_PENALTY_MS;
    state.bac = TUNING.KO_WAKE_BAC;
    syncDrunkFromBac();
    state.pukeRisk = TUNING.KO_WAKE_RISK;
    state.highDrunkMs = 0;
    state.bacOverloadMs = 0;
    state.effects.hangoverCrashMs = TUNING.HANGOVER_CRASH_MS;
    state.pukeCooldownMs = Math.max(state.pukeCooldownMs, 4500);
    state.flow = Math.max(0, state.flow - 0.4);
    addLog("Hangover crash: Bodie's eyes don't work for 10 seconds.");
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
    state.effects.mysteryRushMs = Math.max(0, state.effects.mysteryRushMs - stepMs);
    state.effects.hangoverCrashMs = Math.max(0, state.effects.hangoverCrashMs - stepMs);

    if (state.bodie.mode !== "ko" && state.bodie.modeUntil > 0 && state.timeMs >= state.bodie.modeUntil) {
      state.bodie.mode = "idle";
      state.bodie.modeUntil = 0;
    }
    if (state.bodie.overlayUntil > 0 && state.timeMs >= state.bodie.overlayUntil) {
      state.bodie.overlayMode = "none";
      state.bodie.overlayUntil = 0;
    }
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
    if (state.currentAction.type === "repair" && state.effects.mysteryRushMs > 0) {
      speed *= TUNING.MYSTERY_REPAIR_SPEED_MULTIPLIER;
    }
    if (state.currentAction.type === "repair") {
      speed *= 1 + state.flow * TUNING.FLOW_REPAIR_SPEED_MAX_BONUS;
    }
    if (state.currentAction.type === "repair" && state.effects.hangoverCrashMs > 0) {
      speed *= TUNING.HANGOVER_REPAIR_SPEED_MULTIPLIER;
    }
    const delta = stepMs * speed;
    state.currentAction.remainingMs = Math.max(0, state.currentAction.remainingMs - delta);

    if (state.currentAction.type === "repair") {
      const car = state.carQueue.find((entry) => entry.id === state.currentAction.meta.carId);
      if (car) {
        car.remainingRepairMs = Math.max(0, car.remainingRepairMs - delta);
      }
      const progress = clamp((state.currentAction.totalMs - state.currentAction.remainingMs) / state.currentAction.totalMs, 0, 1);
      state.bodie.repairIntensity = progress > 0.8 ? clamp((progress - 0.8) / 0.2, 0, 1) : 0;
    } else {
      state.bodie.repairIntensity = 0;
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

    let bacDecayPerSec = TUNING.BAC_BASE_DECAY_PER_SEC;
    if (state.currentAction && state.currentAction.type === "repair") {
      bacDecayPerSec += TUNING.BAC_REPAIR_DECAY_BONUS_PER_SEC;
    }
    bacDecayPerSec += state.hydration * TUNING.BAC_HYDRATION_DECAY_BONUS_PER_SEC;
    if (state.effects.steadyHandsMs > 0) {
      bacDecayPerSec *= TUNING.BAC_CIG_DECAY_MULTIPLIER;
    }
    if (state.effects.dabRushMs > 0) {
      bacDecayPerSec *= TUNING.BAC_DAB_DECAY_MULTIPLIER;
    }
    if (
      state.drunkMeter >= TUNING.SWEET_SPOT_MIN &&
      state.drunkMeter <= TUNING.SWEET_SPOT_MAX &&
      state.currentAction?.type !== "drink"
    ) {
      state.flow = clamp(state.flow + TUNING.FLOW_BUILD_PER_SEC * dt, 0, 1);
      bacDecayPerSec *= 1 - state.flow * TUNING.FLOW_DECAY_REDUCTION_MAX;
    } else {
      state.flow = clamp(state.flow - TUNING.FLOW_DECAY_PER_SEC * dt, 0, 1);
    }

    state.bac = clamp(state.bac - bacDecayPerSec * dt, 0, 1.5);
    state.hydration = clamp(state.hydration + 0.016 * dt, 0, 1);
    state.tolerance = clamp(state.tolerance + 0.009 * dt, 0, 1);
    state.bodie.dirt = clamp(state.bodie.dirt - 0.16 * dt, 0, 100);
    syncDrunkFromBac();

    if (state.drunkMeter > TUNING.PUKE_HIGH_METER_THRESHOLD) {
      state.highDrunkMs += stepMs;
      if (state.highDrunkMs >= TUNING.PUKE_HIGH_METER_GRACE_MS) {
        state.pukeRisk = clamp(
          state.pukeRisk + TUNING.PUKE_HIGH_METER_GAIN_PER_SEC * dt * (1 - state.tolerance * 0.2),
          0,
          TUNING.PUKERISK_MAX
        );
      }
    } else {
      state.highDrunkMs = Math.max(0, state.highDrunkMs - stepMs * 1.2);
    }

    if (state.bac > TUNING.PUKE_OVERLOAD_BAC_THRESHOLD) {
      state.pukeRisk = clamp(
        state.pukeRisk + TUNING.PUKE_OVERLOAD_GAIN_PER_SEC * dt * (1 - state.hydration * 0.25),
        0,
        TUNING.PUKERISK_MAX
      );
    }
    if (state.drunkMeter < TUNING.PUKE_UNDER_CONTROL_THRESHOLD) {
      state.pukeRisk = clamp(state.pukeRisk - TUNING.PUKE_UNDER_CONTROL_DECAY_PER_SEC * dt, 0, TUNING.PUKERISK_MAX);
    }

    if (state.bac > TUNING.KO_BAC_THRESHOLD) {
      state.bacOverloadMs += stepMs;
    } else {
      state.bacOverloadMs = Math.max(0, state.bacOverloadMs - stepMs * 2);
    }
    state.pukeCooldownMs = Math.max(0, state.pukeCooldownMs - stepMs);

    updateStreak(stepMs);
    updateAction(stepMs);
    updateQueue(stepMs);

    if (state.bacOverloadMs >= TUNING.KO_BAC_OVERLOAD_WINDOW_MS) {
      triggerKO("bac-overload");
      return;
    }
    if (state.bac >= TUNING.KO_RANDOM_BAC_THRESHOLD && rand() < TUNING.KO_RANDOM_CHANCE_PER_SEC * dt) {
      triggerKO("critical-random");
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
      "4",
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

    if (isPortraitBlockedLayout()) {
      return;
    }

    if (state.event && state.event.type === "puke" && (key === " " || key === "enter")) {
      mashPuke();
      return;
    }

    if (key === "1") selectBeer(0, true);
    else if (key === "2") selectBeer(1, true);
    else if (key === "3") selectBeer(2, true);
    else if (key === "4") selectBeer(3, true);
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
    window.addEventListener("pointerdown", ensureAudioContext, { passive: true });
    window.addEventListener("resize", detectLayout);
    window.addEventListener("orientationchange", detectLayout);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", detectLayout);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        if (!state.paused && !state.shiftEnded && !state.event) {
          state.paused = true;
          autoPausedByVisibility = true;
          addLog("Auto-paused while tab is hidden.");
        }
        return;
      }
      if (autoPausedByVisibility && !state.shiftEnded && !state.event) {
        state.paused = false;
        autoPausedByVisibility = false;
        addLog("Resumed after returning to tab.");
      }
    });

    ui.gameShell.addEventListener("touchmove", (event) => {
      if (currentLayout !== "mobileLandscape3") return;
      if (event.target.closest(".car-queue") || event.target.closest(".log-feed")) return;
      event.preventDefault();
    }, { passive: false });

    const tapAndRun = (button, fn) => {
      button.addEventListener("click", () => {
        ensureAudioContext();
        animateTapFeedback(button);
        fn();
      });
    };

    tapAndRun(ui.pauseBtn, togglePause);
    tapAndRun(ui.resetBtn, () => resetRun(false));
    ui.soundToggle.addEventListener("click", () => {
      state.settings.soundOn = !state.settings.soundOn;
      if (state.settings.soundOn) {
        ensureAudioContext();
        playTone("start");
      }
      saveSettings();
    });

    ui.compactModeToggle.addEventListener("click", () => {
      const modeOrder = ["auto", "on", "off"];
      const next = modeOrder[(modeOrder.indexOf(state.settings.compactMode) + 1) % modeOrder.length];
      state.settings.compactMode = next;
      saveSettings();
      detectLayout();
    });

    ui.mobileLayoutToggle.addEventListener("click", () => {
      state.settings.mobile3PanelLayout = !state.settings.mobile3PanelLayout;
      saveSettings();
      detectLayout();
    });

    ui.portraitPauseToggle.addEventListener("click", () => {
      state.settings.autoPauseOnPortrait = !state.settings.autoPauseOnPortrait;
      saveSettings();
      detectLayout();
    });

    tapAndRun(ui.drinkBtn, startDrink);
    tapAndRun(ui.fixBtn, startRepair);
    tapAndRun(ui.cancelRepairBtn, cancelRepair);
    tapAndRun(ui.cigBtn, () => startBonus("cigarette"));
    tapAndRun(ui.dabBtn, () => startBonus("dab"));
    tapAndRun(ui.thingBtn, () => startBonus("thing"));

    tapAndRun(ui.dockDrinkBtn, startDrink);
    tapAndRun(ui.dockFixBtn, startRepair);
    tapAndRun(ui.dockCigBtn, () => startBonus("cigarette"));
    tapAndRun(ui.dockDabBtn, () => startBonus("dab"));
    tapAndRun(ui.dockThingBtn, () => startBonus("thing"));
    tapAndRun(ui.dockPauseBtn, togglePause);
    tapAndRun(ui.actionPauseBtn, togglePause);

    const onBeerTap = (event) => {
      const target = event.target.closest("[data-index]");
      if (!target) return;
      const idx = Number(target.dataset.index);
      if (!Number.isFinite(idx)) return;
      selectBeer(idx, false);
      animateTapFeedback(target);
    };
    ui.beerList.addEventListener("click", onBeerTap);
    ui.mobileBeerSegment.addEventListener("click", onBeerTap);

    const onCarTap = (event) => {
      const target = event.target.closest("[data-car-id]");
      if (!target) return;
      const id = Number(target.dataset.carId);
      if (!Number.isFinite(id)) return;
      state.selectedCarId = id;
    };
    ui.carQueue.addEventListener("click", onCarTap);
    ui.mobileCarQuickSelect.addEventListener("click", onCarTap);

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

    if (ui.rotateOverlay) {
      ui.rotateOverlay.addEventListener("click", detectLayout);
    }

    tapAndRun(ui.mobilePauseBtn, togglePause);
    tapAndRun(ui.mobileJumpBtn, () => {
      startDrink();
      playTone("tap");
      vibratePulse(18);
    });
    tapAndRun(ui.mobileSpecialBtn, () => {
      startBonus("thing");
      playTone("start");
      vibratePulse(24);
    });

    ui.leftHandToggle.addEventListener("click", () => {
      touchState.leftHanded = !touchState.leftHanded;
      state.settings.leftHanded = touchState.leftHanded;
      ui.leftHandToggle.setAttribute("aria-pressed", String(touchState.leftHanded));
      ui.leftHandToggle.textContent = `Left-handed: ${touchState.leftHanded ? "On" : "Off"}`;
      saveSettings();
      detectLayout();
    });

    const onLeftTouch = (event) => {
      if (currentLayout !== "mobileLandscape3") return;
      for (const touch of event.changedTouches) {
        if (touchState.joystick.active) continue;
        touchState.joystick.active = true;
        touchState.joystick.id = touch.identifier;
        const rect = ui.leftPadCanvas.getBoundingClientRect();
        const scaleX = ui.leftPadCanvas.width / rect.width;
        const scaleY = ui.leftPadCanvas.height / rect.height;
        touchState.joystick.baseX = (touch.clientX - rect.left) * scaleX;
        touchState.joystick.baseY = (touch.clientY - rect.top) * scaleY;
      }
    };
    const onLeftMove = (event) => {
      if (!touchState.joystick.active) return;
      const rect = ui.leftPadCanvas.getBoundingClientRect();
      const scaleX = ui.leftPadCanvas.width / rect.width;
      const scaleY = ui.leftPadCanvas.height / rect.height;
      const radius = Math.min(ui.leftPadCanvas.width, ui.leftPadCanvas.height) * 0.22;
      for (const touch of event.changedTouches) {
        if (touch.identifier !== touchState.joystick.id) continue;
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;
        let dx = x - touchState.joystick.baseX;
        let dy = y - touchState.joystick.baseY;
        const dist = Math.hypot(dx, dy);
        if (dist > radius) {
          const k = radius / dist;
          dx *= k; dy *= k;
        }
        touchState.joystick.dx = Math.abs(dx) < radius * 0.16 ? 0 : dx;
        touchState.joystick.dy = Math.abs(dy) < radius * 0.16 ? 0 : dy;
      }
      event.preventDefault();
    };
    const onLeftEnd = (event) => {
      for (const touch of event.changedTouches) {
        if (touch.identifier !== touchState.joystick.id) continue;
        touchState.joystick = { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0 };
      }
    };
    ui.leftPadCanvas.addEventListener("touchstart", onLeftTouch, { passive: true });
    ui.leftPadCanvas.addEventListener("touchmove", onLeftMove, { passive: false });
    ui.leftPadCanvas.addEventListener("touchend", onLeftEnd, { passive: true });
    ui.leftPadCanvas.addEventListener("touchcancel", onLeftEnd, { passive: true });
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

    ui.mobileBeerSegment.innerHTML = DRINKS.map((beer, index) => {
      const selected = index === state.selectedBeerIndex;
      const short = beer.id === "craftipa" ? "IPA" : beer.name.split(" ")[0];
      return `<button type="button" class="segment-btn ${selected ? "selected" : ""}" data-index="${index}" role="radio" aria-checked="${selected}">${short}</button>`;
    }).join("");
  }

  function renderQueue() {
    const signature = JSON.stringify({
      selected: state.selectedCarId,
      actionCar: state.currentAction?.meta?.carId || null,
      queue: state.carQueue.map((car) => [
        car.id,
        Math.round(car.remainingRepairMs / 120),
        Math.round(car.patienceMs / 120),
      ]),
    });

    if (signature !== lastQueueSignature) {
      if (state.carQueue.length === 0) {
        ui.carQueue.innerHTML = "<p>No cars waiting. Enjoy the silence.</p>";
      } else {
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
                <p class="stats">Base ${car.basePoints} pts | ${formatSeconds(car.repairTimeMs)} repair | ${car.repairStyle.replace("repairing_", "")}</p>
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
      lastQueueSignature = signature;
    }

    ui.mobileCarQuickSelect.innerHTML = state.carQueue
      .slice(0, 4)
      .map((car, idx) => `<button type="button" class="quick-car ${car.id === state.selectedCarId ? "selected" : ""}" data-car-id="${car.id}">#${idx + 1}</button>`)
      .join("");
  }

  function renderLogs() {
    const signature = state.logs.join("|");
    if (signature === lastLogSignature) return;
    ui.logFeed.innerHTML = state.logs.map((line) => `<li><em>${line}</em></li>`).join("");
    lastLogSignature = signature;
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
    if (state.effects.mysteryRushMs > 0) {
      effects.push(`mystery god mode ${formatSeconds(state.effects.mysteryRushMs)}`);
    }
    if (state.effects.hangoverCrashMs > 0) {
      effects.push(`hangover crash ${formatSeconds(state.effects.hangoverCrashMs)}`);
    }
    effects.push(`flow ${(state.flow * 100).toFixed(0)}%`);
    ui.effectStatus.textContent = `Effects: ${effects.join(" | ")}`;
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
    const hasCar = !!findSelectedCar();
    ui.fixBtn.disabled = !canAct || !hasCar;
    ui.drinkBtn.disabled = !canAct;
    ui.cigBtn.disabled = !canAct;
    ui.dabBtn.disabled = !canAct;
    ui.thingBtn.disabled = !canAct;
    ui.cancelRepairBtn.disabled = !(state.currentAction && state.currentAction.type === "repair");

    ui.dockFixBtn.disabled = ui.fixBtn.disabled;
    ui.dockDrinkBtn.disabled = ui.drinkBtn.disabled;
    ui.dockCigBtn.disabled = ui.cigBtn.disabled;
    ui.dockDabBtn.disabled = ui.dabBtn.disabled;
    ui.dockThingBtn.disabled = ui.thingBtn.disabled;

    ui.pauseBtn.textContent = state.paused ? "Resume (P)" : "Pause (P)";
    ui.dockPauseBtn.textContent = state.paused ? "Resume" : "Pause";

    ui.soundToggle.textContent = state.settings.soundOn ? "Sound: On" : "Sound: Off";
    ui.soundToggle.setAttribute("aria-pressed", String(state.settings.soundOn));

    const compactText = state.settings.compactMode === "on" ? "Compact: On" : state.settings.compactMode === "off" ? "Compact: Off" : "Compact: Auto";
    ui.compactModeToggle.textContent = compactText;
    ui.compactModeToggle.setAttribute("aria-pressed", String(getCompactModeEnabled()));
    ui.mobileLayoutToggle.textContent = `Mobile Layout: ${state.settings.mobile3PanelLayout ? "3-Panel (Recommended)" : "Classic"}`;
    ui.mobileLayoutToggle.setAttribute("aria-pressed", String(state.settings.mobile3PanelLayout));
    ui.leftHandToggle.textContent = `Left-handed: ${touchState.leftHanded ? "On" : "Off"}`;
    ui.leftHandToggle.setAttribute("aria-pressed", String(touchState.leftHanded));
    ui.portraitPauseToggle.textContent = `Auto-pause portrait: ${state.settings.autoPauseOnPortrait ? "On" : "Off"}`;
    ui.portraitPauseToggle.setAttribute("aria-pressed", String(state.settings.autoPauseOnPortrait));
    ui.actionPauseBtn.textContent = state.paused ? "Resume" : "Pause";
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

    ui.drunkMeterLabel.textContent = `${state.drunkMeter.toFixed(0)}% (BAC ${state.bac.toFixed(2)})`;
    ui.drunkMeterFill.style.width = `${state.drunkMeter.toFixed(1)}%`;
    const pukePct = clamp((state.pukeRisk / TUNING.PUKERISK_THRESHOLD) * 100, 0, 100);
    ui.pukeRiskLabel.textContent = `${state.pukeRisk.toFixed(0)}%`;
    ui.pukeRiskFill.style.width = `${pukePct.toFixed(1)}%`;

    const selected = findSelectedCar();
    ui.selectedCarText.textContent = selected
      ? `Selected car: ${selected.name} (${selected.difficultyTier})`
      : "Selected car: none";

    const actionText = state.currentAction ? state.currentAction.label : state.paused ? "Paused" : "Idle";
    ui.mobileActionText.textContent = `Now Doing: ${actionText}`;
    ui.mobileCarText.textContent = selected ? `Car: ${selected.name}` : "Car: none";
    ui.mobileMultiplierText.textContent = `${getDrunkMultiplier(state.drunkMeter).toFixed(1)}x`;
    ui.dockSelectedCar.textContent = selected ? `Selected: ${selected.name}` : "Selected: none";
    if (ui.mobileHeartsHud) ui.mobileHeartsHud.textContent = `❤️ x${Math.max(1, 3 - Math.floor(state.pukeRisk / 40))}`;
    if (ui.mobileBaconHud) ui.mobileBaconHud.textContent = `🥓 x${Math.floor(state.score / 400)}`;
    if (ui.mobileLevelHud) ui.mobileLevelHud.textContent = `Level ${1 + Math.floor(state.timeMs / 45000)}`;
  }

  function renderBodie() {
    if (!ui.bodieStage || !ui.bodieCaption) {
      return;
    }
    updateBodieAppearance();
    const foamClass = state.timeMs < state.bodie.foamUntil ? "foam-drip" : "";
    ui.bodieStage.className = `bodie-stage mode-${state.bodie.mode} overlay-${state.bodie.overlayMode} ${foamClass} dirt-${getDirtStage(state.bodie.dirt)}`.trim();
    ui.bodieStage.style.setProperty("--repair-intensity", state.bodie.repairIntensity.toFixed(3));
    ui.bodieCaption.textContent = state.bodie.caption;
  }

  function renderDangerVisuals() {
    const motionScale = reduceMotion ? 0.2 : isMobileLayout() ? 0.55 : 1;
    const wobble = clamp((state.drunkMeter - 76) / 24, 0, 1) * motionScale;
    const danger = clamp(
      Math.max((state.drunkMeter - 88) / 12, state.pukeRisk / TUNING.PUKERISK_MAX),
      0,
      1
    ) * (reduceMotion ? 0.7 : 1);
    ui.gameShell.style.setProperty("--wobble-intensity", wobble.toFixed(3));
    ui.gameShell.style.setProperty("--danger-vignette", danger.toFixed(3));
    ui.gameShell.style.setProperty("--effect-strength", String(motionScale));
    ui.gameShell.classList.toggle("is-wobbly", wobble > 0.02);
    ui.gameShell.classList.toggle("is-timewarp", state.bodie.overlayMode === "timewarp" && !reduceMotion);
  }

  function render() {
    renderMobileCanvas();
    renderJoystickPad();
    renderHUD();
    renderBeerList();
    renderQueue();
    renderActionStatus();
    renderEffects();
    renderButtons();
    renderLogs();
    renderOverlay();
    renderBodie();
    renderDangerVisuals();
  }

  function frame(ts) {
    const delta = Math.min(120, ts - lastFrameTs);
    lastFrameTs = ts;
    if (document.visibilityState !== "hidden") {
      if (isPortraitBlockedLayout()) {
        if (ts - lastRotateOverlayFrame > 48) {
          renderRotateHint(ts);
          lastRotateOverlayFrame = ts;
        }
      } else {
        tick(delta);
        render();
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    lastFrameTs = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function setupMotionPreferenceListener() {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => {
      reduceMotion = motionQuery.matches;
      document.body.dataset.reducedMotion = String(reduceMotion);
    };
    applyMotion();
    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", applyMotion);
    } else if (typeof motionQuery.addListener === "function") {
      motionQuery.addListener(applyMotion);
    }
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
      bac: Number(state.bac.toFixed(3)),
      hydration: Number(state.hydration.toFixed(3)),
      tolerance: Number(state.tolerance.toFixed(3)),
      flow: Number(state.flow.toFixed(3)),
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
        repair_style: car.repairStyle,
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
  touchState.leftHanded = !!state.settings.leftHanded;
  setupMotionPreferenceListener();
  detectLayout();
  resetRun(true);
  bindEvents();
  startLoop();
  render();

  /*
    Mobile landscape-first update summary:
    - Added mobile orientation gate with animated rotate overlay and low-cost portrait loop.
    - Added mobile 3-panel arena (left movement, center canvas viewport, right actions/HUD).
    - Added center-region scale math + DPR crisp canvas rendering + panel clipping.
    - Added joystick touch handling, jump/special/pause touch actions, haptics + UI tones.
    - Added settings toggles for mobile 3-panel mode and left-handed mode swap.

    Quick rotate test (iOS/Android):
    1) Open game on phone in portrait: verify rotate overlay shows and game is paused.
    2) Rotate to landscape: overlay fades away and 3-panel layout appears.
    3) Tap Jump/Special/Pause + move joystick area; verify feedback/haptics and resumed gameplay.
  */
})();
