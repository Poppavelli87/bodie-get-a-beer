(() => {
  "use strict";

  const STORAGE_KEYS = {
    highScore: "bodie_get_a_beer_high_score",
    settings: "bodie_get_a_beer_settings",
    highscores: "bodie_highscores_v1",
    playerName: "bodie_player_name",
  };

  const STEP_MS = 1000 / 60;
  const MAX_LOG_ENTRIES = 60;

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


  const BODIE_DIALOGUE = {
    stages: {
      0: { idle:["Shop radio says 72 and sunny. My sockets agree.","One bolt, one breath, one legally reasonable plan.","If we pace this right nobody calls my aunt lawyer.","I can still read torque specs with both eyes.","Coffee is just pre-beer for mechanics.","I trust this wrench exactly medium.","Alignment is therapy for cars and men.","Warranty sticker looked at me first.","Today we are professionals. Mostly.","This floor squeak means luck."], repair:["Gentle torque, civilized outcomes.","Wrench says yes, knuckles say maybe.","Alternator whispered an apology.","We respect threads in this house.","That rattle is now a memory.","OSHA would call this almost compliant.","I fixed it with confidence and two zip ties.","Tires are circles and so is destiny.","This bolt came out because I asked politely.","No hammers needed. I feel mature."], drink:["Hydration by barley begins.","One sip for morale.","Light beer: the responsible rocket fuel.","I call this calibration.","Beer selected with scientific intent.","Carbonation improves diagnostics.","This is preventative maintenance for my soul.","Shop wizardry requires a cold opener.","Sip now, wisdom later.","Foam beard online."] },
      1: { idle:["Okay now we're loose but employable.","I can hear the tires gossiping.","Who moved the 10mm? Don't answer.","The lift creaks in iambic pentameter.","I'm becoming one with this fan belt.","Mood: medium illegal, high productive.","My handwriting is now cursive lightning.","I winked at a carburetor and it winked back.","Loose shoulders, tight tolerances.","This shop smells like victory and old fries."], repair:["Percussive maybe-maintenance engaged.","That bolt is innocent until proven stripped.","I object to this rust spiritually.","Transmission said no, I said bet.","I tightened until truth emerged.","Two turns past scared is perfect.","Alignment is a social construct but we try.","The muffler has accepted my terms.","I repaired this with jazz timing.","This wiring harness owes me rent."], drink:["Tallboy means we're serious now.","Crack. Sip. Confidence unlocked.","This can has legal advice on it.","I drink for peak diagnostics.","Beer type selected by aura.","This sip tastes like overtime.","Foam said you got this.","Craft IPA has entered the courtroom.","One more sip and I can see horsepower.","Mystery beer? We respect chaos."] },
      2: { idle:["Conspiracy level: tire shop.","The EPA put a snitch in this O2 sensor.","Warranties are horoscopes for engines.","I think this jack stand is wired.","That alternator is hiding federal secrets.","Camber is just politics for wheels.","Alignment lasers are reading my thoughts.","This invoice has encrypted runes.","The shop cat works for Big Coolant.","I'm not paranoid, I'm torque-aware."], repair:["Objection: this bolt knew what it did.","I prosecute stripped threads with vigor.","This alternator was replaced by actors.","They don't want us to know about free torque.","I present Exhibit A: oily fingerprints.","Jury of sockets finds this nut guilty.","The evidence points to sabotage by cup holders.","Cross-examining this axle in real time.","This wrench is under oath.","Case closed. Engine starts."], drink:["IPA opens the third service eye.","Tallboy testimony accepted.","Beer foams like classified documents.","Mystery can from an unmarked cooler? Perfect.","One sip and I decode check-engine Morse.","I drink to reveal hidden recalls.","This can definitely has surveillance bubbles.","Light beer? plausible deniability.","Sipping for national torque security.","Carbonation witnesses everything."] },
      3: { idle:["We are in the enlightenment zone.","Engine cycles mirror the human condition.","Spark is desire, compression is discipline.","Every gasket is a boundary.","I am both mechanic and metaphor.","The lift rises, as do we.","A clean idle is inner peace.","Pistons: tiny monks of combustion.","I found meaning in a drain pan.","Time is a torque curve."], repair:["I repair therefore I am.","Tightening this bolt tightens my spirit.","This wrench is a tuning fork for fate.","Oil return is karma.","Belts spin like samsara.","The socket clicks and so does the universe.","We align wheels to align intentions.","This headlight now points toward purpose.","In this bay, entropy pays rent.","I forgive this rust."], drink:["A sip to honor the machine spirit.","Foam crown of temporary wisdom.","This can tastes like transcendence and barley.","Drinking with mindful slouch.","Tallboy as koan.","Craft IPA, teacher of humble burps.","Mystery beer asks no questions.","I sip, therefore we continue.","Carbonation is the sound of now.","Cheers to impermanence and brake pads."] },
      4: { idle:["WHO STOLE THE TORQUE FROM THIS ROOM??","I AM 73% GREASE 27% LAWYER.","THE FLOOR IS MOVING BUT I'M MOVING BETTER.","OSHA CAN CATCH ME IF THEY CAN.","THE TIRES ARE WHISPERING IN ALL CAPS.","I HAVE BECOME A SHOP WEATHER SYSTEM.","NO ONE TOUCH MY EMOTIONAL RATCHET.","I'M A CREATURE OF OIL NOW.","THIS INVOICE IS A THREAT LETTER.","MY SHADOW LOOKS FLAMMABLE."], repair:["BOLT COURT IS NOW IN SESSION!!!","I SENTENCED THIS NUT TO 40 FT-LBS.","HAMMER OF JUSTICE, GENTLY APPLIED.","THE ALTERNATOR CONFESSED WITHOUT A LAWYER.","THREADS STRIPPED? SO IS MY PATIENCE.","I TORQUED THROUGH THREE DIMENSIONS.","WIRING HARNESS TRIED TO RUN.","I FIXED IT AND YELLED AT PHYSICS.","THIS ENGINE OWES CHILD SUPPORT.","OBJECTION OVERRULED BY WRENCH."], drink:["TALLBOY ACQUIRED. JUDGMENT DECLINED.","MYSTERY BEER TASTES LIKE A DARE.","I DRANK THAT FOR NATIONAL SECURITY.","IPA? MORE LIKE API FOR MY BRAIN.","CARBONATION HAS BECOME A WEAPON.","THIS SIP HAD A BOSS FIGHT.","FOAM EVERYWHERE. VISION OPTIONAL.","I CRACKED A CAN AND REALITY FLINCHED.","LIGHT BEER, HEAVY CONSEQUENCES.","ANOTHER SIP, NO FURTHER QUESTIONS."] },
      5: { idle:["THE SHOP LIGHTS ARE CONSTELLATIONS.","I CAN HEAR BOLTS PRAYING.","COSMIC TRANSMISSION: BRING ME A 10MM.","MY SOUL JUST MISFIRED.","I AM FLOATING THREE INCHES ABOVE OSHA.","THE ALIGNMENT RACK IS A STAR MAP.","I'M RECEIVING MESSAGES FROM RADIATORS.","TIME IS A CHECK ENGINE LIGHT.","I TASTED INFINITY; IT WAS COOLANT-ADJACENT.","I AM LEGALLY A PHENOMENON."], repair:["I TORQUE BY STARLIGHT.","THIS BOLT EXISTS IN MULTIPLE STATES.","WIRING BECOMES CONSTELLATION.","THE ENGINE STARTED IN ANOTHER TIMELINE.","I REPAIRED THE IDEA OF THIS CAR.","GASKET SEALED ACROSS REALITIES.","HAMMER STRIKE ECHOED THROUGH THE VOID.","I HAVE SPOKEN TO THE ALTERNATOR GOD.","THIS MUFFLER NOW SINGS IN CHOIRS.","WE ARE BEYOND SPEC SHEETS."], drink:["MYSTERY BEER OPENED A PORTAL.","I DRANK THE MILKY WAY LITE.","THIS SIP ARRIVED YESTERDAY.","THE CAN IS EMPTY BUT STILL TALKING.","CARBONATION IS COSMIC BACKGROUND NOISE.","I TOAST THE VOID.","FOAM FORMS SACRED GEOMETRY.","ONE SIP FROM KO OBLIVION.","IPA OF DESTINY ACCEPTED.","LIGHT BEER, DARK PROPHECY."] }
    },
    modalities: { philosophical:{lines:["A bolt is just a promise with threads.","Engines teach us: compression before ignition.","Every leak is a boundary asking for care.","We are all torque on borrowed time.","Alignment begins in the heart rack.","Idle smooth, think smooth.","Failure is diagnostics in costume.","A wrench is a tiny philosopher king.","Carburetors are questions with fuel.","Pistons rise and fall like confidence.","Listen to the rattle; it's telling the truth.","I tighten therefore we continue.","Oil changes are acts of forgiveness.","The shop is a temple of second chances.","The manual is only a suggestion of reality."]}, conspiracy:{lines:["Big Alignment made that pothole.","EPA put a tracker in this dipstick.","That warranty is a psyop.","Alternators are listening devices.","This tire wear pattern is a map.","Coolant color codes are a distraction.","The dealership erased the real torque.","Battery terminals are tiny antennas.","Muffler rust was an inside job.","They don't want us rotating tires this often.","The check-engine light blinks in code.","Cabin filter is where the truths hide.","This recall notice came from space.","Who profits from stripped bolts?","I will not be silenced by service intervals."]}, wizard:{lines:["Behold, socketus maximus.","I cast Grease Shield level two.","By the moon of Milwaukee, tighten!","Shop wizardry requires exactly one dramatic sip.","This ratchet is my wand.","Arcane coolant transfer commencing.","Runes indicate a loose serpentine.","I summon the spirit of the 10mm.","Hexes for hex bolts.","The bay is now enchanted.","Mystic torque achieved.","By spark and steel, awaken.","I've prepared a cantrip called hammer.","Wiring sigils are complete.","The hoist obeys the old language."]}, nihilistSmoker:{lines:["Nothing matters, but ash falls evenly.","Entropy always gets paid.","We're all just temporary gaskets.","The smoke knows there is no finish line.","Today's fix is tomorrow's rattle.","I exhale, therefore I cope.","Rust is destiny with texture.","All warranties end. So do we.","The ember understands futility.","I chase peace between coughs.","The universe is a stripped screw.","No gods, no masters, only torque.","Meaning is optional; repairs are not.","Night shift is forever.","Pass me the lighter and the void."]}, dabSage:{lines:["I can see torque in slow motion.","That dab bent spacetime politely.","The socket is speaking fluent jazz.","Color now has horsepower.","I understand this engine emotionally.","Reality got 12% softer.","I just fixed a vibe leak.","My third eye has safety squints.","I can hear piston thoughts.","This bolt is on a spiritual journey.","Timeline split: both cars start.","Dab wisdom: don't trust smooth idles.","I entered the zone; zone said hi.","The wrench left a light trail.","Everything smells like destiny and citrus."]}, angryBolt:{lines:["THIS BOLT IS GUILTY.","I DEMAND MAXIMUM TORQUE.","THREAD COURT IS OPEN.","NO PLEA DEALS FOR RUST.","I WILL CROSS-EXAMINE THIS NUT.","SENTENCED TO TIGHTNESS.","OBJECTION: FLIMSY BRACKET.","THE EVIDENCE IS METALLIC.","JURY OF SOCKETS AGREES.","BAILIFF, HOLD MY BEER.","THIS FASTENER LIED UNDER OATH.","ORDER IN THE BAY.","I PROSECUTE WOBBLE.","CASE LAW: HAMMER V. BOLT.","VERDICT: STARTS FIRST TRY."]}, cosmic:{lines:["TRANSMISSION FROM ORION: CHECK FLUIDS.","THE VOID REQUESTS A TEST DRIVE.","I AM RECEIVING BEEP CODES FROM GOD.","KO IS JUST A LOADING SCREEN.","THE STARS SAY DON'T FLOOR IT.","MY SPINE IS A LIGHTNING HARNESS.","WE ARE ALL SPARK IN A METAL DREAM.","I SEE THE SHOP FROM OUTSIDE TIME.","THE LIFT ASCENDS TO HEAVENLY SPEC.","ANTIFREEZE IS STARDUST JUICE.","I CAN TASTE RADIO WAVES.","THIS BAY FLOATS BETWEEN DIMENSIONS.","THE CHECK ENGINE LIGHT IS A SUN.","SEND HELP OR A TALLBOY.","COSMOS SAYS: TIGHTEN HALF TURN MORE."]} },
    dirt:{high:["I'm officially shop seasoned.","My shirt is now a historical artifact.","Grease count rising; charisma too.","Oil freckles unlocked.","I squeak when I blink.","I'm one nap away from becoming a mop.","Hands are 80% lubricant.","This is not dirt, this is armor.","I smell like a victorious leak.","Creature mode: warming up."],extreme:["I HAVE BECOME THE OIL.","Do not separate me from the floor pan.","I leave footprints of pure mechanic.","EPA hotline probably ringing.","I am now a sentient spill.","My aura is 5W-30.","I could slide under a car without moving.","The grime has accepted me.","I'm legally a shop cryptid.","If I stand still, cones appear."]},
    events:{puke:["Containment protocol failed.","The floor has seen too much.","Some fluids are voluntary, some are lore.","I lost an argument with gravity.","Puke event entered the chat.","That was not in the service manual.","Dignity: temporarily out of stock.","Biohazard aura unlocked."],ko:["Tell the bolts I fought bravely.","Temporary shutdown for spiritual reboot.","I blacked out at 120 proof ideas.","Out cold, still iconic.","Body offline, vibes online.","KO delivered by destiny and barley.","I need a nap and a new timeline.","Floor caught me like family."]},
    beers:{light:["Light beer, light consequences.","Diet chaos selected.","Session fuel loaded.","This one keeps the wrench steady-ish.","A polite little yeasty whisper.","Light beer: plausible competence."],tallboy:["Tallboy: the people's chalice.","Vertical can, horizontal judgment.","Tallboy says commit.","Large format confidence.","One tallboy, two bad ideas.","This can has gravitas."],ipa:["IPA with notes of pine and poor impulse control.","Craft bitterness, artisan chaos.","Hop-powered overconfidence online.","This IPA has opinions.","I can taste expensive mistakes.","Floral nose, feral outcomes."],mystery:["Mystery beer tastes like a side quest.","Unlabeled can, undeniable destiny.","This came from a cooler with secrets.","Mystery beer has chapter select.","I can't identify this but it identifies me.","Could be beer, could be prophecy."]},
    repairs:{wrench:["Wrench diplomacy in progress.","Torque talks, excuses walk.","Ratchet symphony begins.","Thread whisperer mode.","Socket seated like destiny.","Lefty loosey, righty redemption.","Precision bonk avoided.","This wrench and I have history."],pour:["Mystery fluid application authorized.","Pour first, ask legal later.","Coolant? maybe. confidence? yes.","A measured glug of destiny.","Fluid transfer and emotional support.","This funnel is sacred.","We are lubricating outcomes.","If it drips, it ships."],hammer:["Percussive diplomacy initiated.","Tap tap, mechanical poetry.","Hammer says hurry.","Bonk science activated.","The old ways still work.","Gentle violence, positive outcomes.","Strike true, apologize never.","I fixed it with rhythm."],wiring:["Spicy spaghetti management.","Wiring loom untangled by faith.","Electric whispers becoming useful.","Copper therapy session.","Continuity blessed.","This wire had trust issues.","Voltage negotiations underway.","No sparks means victory."]}
  };

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
    streakBestSeconds: 0,
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
      voice: {
        stage: 0,
        modality: null,
        modalityUntilMs: 0,
        nextBanterAtMs: 0,
        nextBigLineAtMs: 0,
        recentLines: [],
        lastTrigger: null,
        flags: { dabActive: false, cigActive: false },
      },
    },
    logs: [],
    highScores: [],
    lastEnteredName: "",
    results: null,
    pendingHighScoreEntry: null,
    activeModal: null,
    toastTimeout: 0,
    settings: {
      soundOn: true,
      compactMode: "auto",
      bodieBanter: true,
      banterFrequency: "normal",
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
    banterToggle: document.getElementById("banterToggle"),
    banterFrequencyToggle: document.getElementById("banterFrequencyToggle"),
    actionPauseBtn: document.getElementById("actionPauseBtn"),
    layoutIndicator: document.getElementById("layoutIndicator"),
    queuePanel: document.getElementById("queuePanel"),
    stagePanel: document.getElementById("stagePanel"),
    stagePanelSlot: document.getElementById("stagePanelSlot"),
    actionPanel: document.getElementById("actionPanel"),
    logPanel: document.getElementById("logPanel"),
    queuePanelToggle: document.getElementById("queuePanelToggle"),
    actionPanelToggle: document.getElementById("actionPanelToggle"),
    logPanelToggle: document.getElementById("logPanelToggle"),
    openHighScoresBtn: document.getElementById("openHighScoresBtn"),
    shareBanner: document.getElementById("shareBanner"),
    shareBannerText: document.getElementById("shareBannerText"),
    shareBannerClose: document.getElementById("shareBannerClose"),
    resultsModal: document.getElementById("resultsModal"),
    resultsCloseBtn: document.getElementById("resultsCloseBtn"),
    resultsSummary: document.getElementById("resultsSummary"),
    resultsFunnyLine: document.getElementById("resultsFunnyLine"),
    resultsPlayAgainBtn: document.getElementById("resultsPlayAgainBtn"),
    resultsHighScoresBtn: document.getElementById("resultsHighScoresBtn"),
    resultsShareBtn: document.getElementById("resultsShareBtn"),
    highScoresModal: document.getElementById("highScoresModal"),
    highScoresCloseBtn: document.getElementById("highScoresCloseBtn"),
    highScoresBody: document.getElementById("highScoresBody"),
    resetHighScoresBtn: document.getElementById("resetHighScoresBtn"),
    newHighScoreModal: document.getElementById("newHighScoreModal"),
    newHighScoreCloseBtn: document.getElementById("newHighScoreCloseBtn"),
    highScoreNameInput: document.getElementById("highScoreNameInput"),
    highScoreNameError: document.getElementById("highScoreNameError"),
    saveHighScoreBtn: document.getElementById("saveHighScoreBtn"),
    toast: document.getElementById("toast"),
  };

  let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let autoPausedByVisibility = false;
  let lastQueueSignature = "";
  let lastLogSignature = "";
  let audioCtx = null;
  let rafId = 0;
  let lastFrameTs = performance.now();
  let accumulatorMs = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isSmallViewport() {
    const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    return Math.min(vw, vh) < 800;
  }

  function getCompactModeEnabled() {
    if (state.settings.compactMode === "on") return true;
    if (state.settings.compactMode === "off") return false;
    return isSmallViewport();
  }

  function applyLayoutState() {
    document.body.dataset.layout = "desktop";
    document.body.dataset.compact = String(getCompactModeEnabled());
    if (ui.layoutIndicator) {
      ui.layoutIndicator.textContent = "Desktop";
    }
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
      if (nextStage >= 4) {
        pushBodieLine(pickLine([BODIE_DIALOGUE.dirt.high]), "event");
      }
      if (nextStage >= 5) {
        pushBodieLine(pickLine([BODIE_DIALOGUE.dirt.extreme]), "event");
      }
      queueBanter("dirt_stage", 2);
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

  function addLog(text, options = {}) {
    const entry = {
      text,
      source: options.source || "system",
      kind: options.kind || "normal",
      stage: Number.isFinite(options.stage) ? options.stage : null,
    };
    state.logs.unshift(entry);
    if (state.logs.length > MAX_LOG_ENTRIES) {
      state.logs.length = MAX_LOG_ENTRIES;
    }
  }

  function getBodieFunnyLine() {
    const lines = state.logs.filter((entry) => entry.source === "bodie" && (entry.kind === "big" || entry.kind === "event"));
    if (lines.length) return lines[0].text;
    const anyBodie = state.logs.find((entry) => entry.source === "bodie");
    return anyBodie ? anyBodie.text : "Bodie: Torque first, explanations never.";
  }

  function getModeLabel() {
    return "Classic Shift";
  }

  function bestStreakSeconds() {
    return Math.max(state.streakBestSeconds || 0, Math.floor(state.streakMs / 1000));
  }

  function formatDateShort(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  }

  function normalizeHighScores(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => ({
        name: typeof entry?.name === "string" ? entry.name.trim().slice(0, 12) : "BODIE",
        score: Math.max(0, Math.floor(Number(entry?.score) || 0)),
        dateISO: typeof entry?.dateISO === "string" ? entry.dateISO : new Date().toISOString(),
        streakBest: Math.max(0, Math.floor(Number(entry?.streakBest) || 0)),
        modeLabel: typeof entry?.modeLabel === "string" && entry.modeLabel ? entry.modeLabel : "Classic Shift",
      }))
      .filter((entry) => entry.name.length >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  function saveHighScoreList() {
    localStorage.setItem(STORAGE_KEYS.highscores, JSON.stringify(state.highScores));
  }

  function renderHighScoresTable() {
    if (!ui.highScoresBody) return;
    if (!state.highScores.length) {
      ui.highScoresBody.innerHTML = '<tr><td colspan="5">No scores yet. Make Bodie proud.</td></tr>';
      return;
    }
    ui.highScoresBody.innerHTML = state.highScores
      .map((entry, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${entry.name}</td>
          <td>${entry.score}</td>
          <td>${entry.streakBest}s</td>
          <td>${formatDateShort(entry.dateISO)}</td>
        </tr>
      `)
      .join("");
  }

  function openModal(name) {
    const all = [ui.resultsModal, ui.highScoresModal, ui.newHighScoreModal];
    all.forEach((m) => m && m.classList.add("hidden"));
    state.activeModal = name || null;
    if (!name) return;
    const target = name === "results" ? ui.resultsModal : name === "highscores" ? ui.highScoresModal : ui.newHighScoreModal;
    if (target) target.classList.remove("hidden");
  }

  function closeAllModals() {
    openModal(null);
  }

  function showToast(message) {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.classList.remove("hidden");
    if (state.toastTimeout) clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(() => ui.toast.classList.add("hidden"), 2200);
  }

  function sanitizePlayerName(name) {
    const trimmed = String(name || "").trim().replace(/\s+/g, " ");
    if (!/^[A-Za-z0-9 ]{3,12}$/.test(trimmed)) return null;
    return trimmed;
  }

  function maybeOpenHighScoreEntry() {
    const qualifies = state.highScores.length < 10 || state.score > state.highScores[state.highScores.length - 1].score;
    if (!qualifies) return;
    state.pendingHighScoreEntry = {
      score: state.score,
      streakBest: bestStreakSeconds(),
      modeLabel: getModeLabel(),
      dateISO: new Date().toISOString(),
    };
    ui.highScoreNameInput.value = state.lastEnteredName || "";
    ui.highScoreNameError.textContent = "";
    openModal("newHighScore");
    ui.highScoreNameInput.focus();
  }

  function savePendingHighScore() {
    if (!state.pendingHighScoreEntry) return;
    const name = sanitizePlayerName(ui.highScoreNameInput.value);
    if (!name) {
      ui.highScoreNameError.textContent = "Use 3-12 letters, numbers, or spaces.";
      return;
    }
    state.lastEnteredName = name;
    localStorage.setItem(STORAGE_KEYS.playerName, name);
    state.highScores.push({ ...state.pendingHighScoreEntry, name });
    state.highScores = normalizeHighScores(state.highScores);
    saveHighScoreList();
    state.pendingHighScoreEntry = null;
    renderHighScoresTable();
    openModal("results");
    showToast("High score saved.");
  }

  function buildResults() {
    const drunkStage = computeBodieStage();
    const dirtStage = getDirtStage(state.bodie.dirt);
    return {
      score: state.score,
      streakBest: bestStreakSeconds(),
      drunkStage,
      dirtStage,
      funnyLine: getBodieFunnyLine(),
    };
  }

  function renderResultsModal() {
    if (!state.results || !ui.resultsSummary) return;
    ui.resultsSummary.innerHTML = `
      <div class="results-item"><strong>Final score</strong>${state.results.score}</div>
      <div class="results-item"><strong>Best streak</strong>${state.results.streakBest}s</div>
      <div class="results-item"><strong>Drunk stage</strong>${state.results.drunkStage}</div>
      <div class="results-item"><strong>Dirt stage</strong>${DIRT_STAGE_LABELS[state.results.dirtStage]}</div>
    `;
    ui.resultsFunnyLine.textContent = state.results.funnyLine;
  }

  function buildSharePayload() {
    const url = new URL(window.location.href);
    const displayName = state.lastEnteredName || "BODIE";
    url.searchParams.set("share", "1");
    url.searchParams.set("score", String(state.results?.score || state.score));
    url.searchParams.set("name", displayName.toUpperCase());
    const text = `I scored ${state.results?.score || state.score} in Bodie Get A Beer. Best streak: ${state.results?.streakBest || bestStreakSeconds()}s. ${state.results?.funnyLine || getBodieFunnyLine()} Play: ${url.toString()}`;
    return { title: "Bodie Get A Beer", text, url: url.toString() };
  }

  async function shareScore() {
    const payload = buildSharePayload();
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (_) {}
    }
    const copyText = payload.text;
    try {
      await navigator.clipboard.writeText(copyText);
      showToast("Copied. Paste into Facebook/Messenger/Discord.");
    } catch (_) {
      showToast("Copy failed. Select and copy manually.");
    }
  }

  function handleShareBannerFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share") !== "1") return;
    const score = Math.max(0, Math.floor(Number(params.get("score") || 0)));
    const nameRaw = (params.get("name") || "Someone").slice(0, 24);
    const name = nameRaw.replace(/[^A-Za-z0-9 ]/g, "").trim() || "Someone";
    ui.shareBannerText.textContent = `${name} scored ${score}. Can you beat it?`;
    ui.shareBanner.classList.remove("hidden");
  }

  function getBanterTiming() {
    const base = state.settings.banterFrequency === "low" ? { banter: 10500, big: 17000 } : state.settings.banterFrequency === "high" ? { banter: 5200, big: 10500 } : { banter: 7600, big: 13000 };
    const drunkFactor = clamp((state.drunkMeter - 20) / 90, 0, 1);
    return {
      banterMs: Math.max(4000, Math.round(base.banter - drunkFactor * 1800)),
      bigMs: Math.max(10000, Math.round(base.big - drunkFactor * 1400)),
    };
  }

  function computeBodieStage() {
    const value = Math.max(state.drunkMeter, state.bac * 100);
    if (value < 25) return 0;
    if (value < 50) return 1;
    if (value < 70) return 2;
    if (value < 85) return 3;
    if (value < 95) return 4;
    return 5;
  }

  function mutateLine(text) {
    if (state.bodie.voice.stage >= 4 && rand() < 0.25) return `${text.toUpperCase()}${rand() < 0.4 ? "!!" : "!"}`;
    if (state.bodie.voice.stage >= 3 && rand() < 0.2) return `${text}${rand() < 0.5 ? "..." : "?!"}`;
    return text;
  }

  function pickLine(pools) {
    const voice = state.bodie.voice;
    const all = pools.flat().filter(Boolean);
    if (!all.length) return null;
    const filtered = all.filter((line) => !voice.recentLines.includes(line));
    const pickPool = filtered.length ? filtered : all;
    return pick(pickPool);
  }

  function pushBodieLine(text, kind = "banter") {
    if (!state.settings.bodieBanter || !text) return;
    const finalText = `Bodie: ${mutateLine(text)}`;
    addLog(finalText, { source: "bodie", kind, stage: state.bodie.voice.stage });
    state.bodie.voice.recentLines.unshift(text);
    if (state.bodie.voice.recentLines.length > 20) state.bodie.voice.recentLines.length = 20;
  }

  function maybeShiftModality(nowMs) {
    const voice = state.bodie.voice;
    if (voice.modality && nowMs < voice.modalityUntilMs) return;
    if (voice.modality && nowMs >= voice.modalityUntilMs) voice.modality = null;
    const weights = [];
    if (voice.stage >= 3) weights.push(["philosophical", 2 + state.streakTier * 0.4]);
    if (voice.stage >= 2) weights.push(["conspiracy", 2 + state.bodie.dishevelLevel * 0.5]);
    if (voice.stage >= 1 && state.currentAction?.type === "repair") weights.push(["wizard", 1.8]);
    if (voice.flags.cigActive) weights.push(["nihilistSmoker", 3.3]);
    if (voice.flags.dabActive) weights.push(["dabSage", 3.5]);
    if (voice.lastTrigger === "finish_repair" || voice.lastTrigger === "cancel_repair") weights.push(["angryBolt", 2.7]);
    if (voice.stage >= 5 || state.event?.type === "ko" || state.bac > 1.35) weights.push(["cosmic", 5]);
    if (!weights.length || rand() > 0.22) return;
    const picked = weightedPick(weights, (w) => w[1])[0];
    voice.modality = picked;
    voice.modalityUntilMs = nowMs + randInt(10000, 30000);
  }

  function queueBanter(trigger, intensity = 1) {
    const voice = state.bodie.voice;
    voice.lastTrigger = trigger;
    if (!state.settings.bodieBanter) return;
    const nowMs = state.timeMs;
    const timing = getBanterTiming();
    voice.nextBanterAtMs = Math.min(voice.nextBanterAtMs || nowMs, nowMs + Math.max(4000, Math.floor(timing.banterMs * (1 - intensity * 0.06))));
    if (voice.stage >= 2) voice.nextBigLineAtMs = Math.min(voice.nextBigLineAtMs || nowMs, nowMs + Math.max(10000, Math.floor(timing.bigMs * (1 - intensity * 0.05))));
  }

  function getTriggerPools(trigger) {
    const stage = state.bodie.voice.stage;
    const stageSet = BODIE_DIALOGUE.stages[stage] || BODIE_DIALOGUE.stages[0];
    const pools = [stageSet.idle];
    if (trigger.includes("repair")) pools.push(stageSet.repair);
    if (trigger.includes("drink")) pools.push(stageSet.drink);
    if (trigger === "puke_start" || trigger === "puke_fail" || trigger === "puke_success") pools.push(BODIE_DIALOGUE.events.puke);
    if (trigger === "ko") pools.push(BODIE_DIALOGUE.events.ko);
    if (state.bodie.dirt >= 70) pools.push(BODIE_DIALOGUE.dirt.high);
    if (state.bodie.dirt >= 88) pools.push(BODIE_DIALOGUE.dirt.extreme);
    if (trigger === "finish_drink") {
      const id = DRINKS[state.selectedBeerIndex]?.id;
      if (id === "craftipa") pools.push(BODIE_DIALOGUE.beers.ipa);
      else pools.push(BODIE_DIALOGUE.beers[id] || BODIE_DIALOGUE.beers.light);
    }
    const selected = findSelectedCar?.();
    if (selected?.repairStyle) {
      const style = selected.repairStyle.replace("repairing_", "");
      if (BODIE_DIALOGUE.repairs[style]) pools.push(BODIE_DIALOGUE.repairs[style]);
    }
    if (state.bodie.voice.modality && BODIE_DIALOGUE.modalities[state.bodie.voice.modality]) {
      pools.push(BODIE_DIALOGUE.modalities[state.bodie.voice.modality].lines);
    }
    return pools;
  }

  function updateBodieVoice(nowMs, dtMs) {
    const voice = state.bodie.voice;
    voice.stage = computeBodieStage();
    voice.flags.dabActive = state.effects.dabRushMs > 0;
    voice.flags.cigActive = state.effects.steadyHandsMs > 0;
    maybeShiftModality(nowMs);
    if (!state.settings.bodieBanter || state.event) return;
    if (!voice.nextBanterAtMs) {
      const t = getBanterTiming();
      voice.nextBanterAtMs = nowMs + t.banterMs;
      voice.nextBigLineAtMs = nowMs + t.bigMs;
    }
    if (nowMs >= voice.nextBanterAtMs) {
      const line = pickLine(getTriggerPools(voice.lastTrigger || "idle"));
      pushBodieLine(line, "banter");
      voice.nextBanterAtMs = nowMs + getBanterTiming().banterMs;
    }
    if (voice.stage >= 2 && nowMs >= voice.nextBigLineAtMs) {
      const line = pickLine(getTriggerPools("big"));
      pushBodieLine(line, "big");
      voice.nextBigLineAtMs = nowMs + getBanterTiming().bigMs;
    }
  }

  function loadStorage() {
    const parsedHigh = Number(localStorage.getItem(STORAGE_KEYS.highScore) || "0");
    state.highScore = Number.isFinite(parsedHigh) ? Math.max(0, Math.floor(parsedHigh)) : 0;
    state.lastEnteredName = String(localStorage.getItem(STORAGE_KEYS.playerName) || "").slice(0, 12);
    try {
      const scores = JSON.parse(localStorage.getItem(STORAGE_KEYS.highscores) || "[]");
      state.highScores = normalizeHighScores(scores);
    } catch (_) {
      state.highScores = [];
    }
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || "{}");
      if (typeof parsed.soundOn === "boolean") {
        state.settings.soundOn = parsed.soundOn;
      }
      if (["auto", "on", "off"].includes(parsed.compactMode)) {
        state.settings.compactMode = parsed.compactMode;
      }
      if (typeof parsed.bodieBanter === "boolean") {
        state.settings.bodieBanter = parsed.bodieBanter;
      }
      if (["low", "normal", "high"].includes(parsed.banterFrequency)) {
        state.settings.banterFrequency = parsed.banterFrequency;
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
    state.results = null;
    state.pendingHighScoreEntry = null;
    closeAllModals();
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
    state.bodie.voice.stage = computeBodieStage();
    state.bodie.voice.modality = null;
    state.bodie.voice.modalityUntilMs = 0;
    state.bodie.voice.nextBanterAtMs = 0;
    state.bodie.voice.nextBigLineAtMs = 0;
    state.bodie.voice.recentLines = [];
    state.bodie.voice.lastTrigger = null;
    state.bodie.voice.flags.dabActive = false;
    state.bodie.voice.flags.cigActive = false;
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
    queueBanter(`start_${payload.type}`, 1);
    return true;
  }

  function startRepair() {
    const car = findSelectedCar();
    if (!car) {
      addLog("No car selected. Bodie argues with a toolbox instead.");
      queueBanter("start_repair", 1);
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
      queueBanter("cancel_repair", 2);
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
    queueBanter("finish_repair", 2);
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
    queueBanter("finish_drink", 2);
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
      queueBanter("cig", 2);
    } else {
      addLog("Nicotine serenity: drain slowed and Bodie feels suspiciously focused.");
      queueBanter("cig", 1);
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
      queueBanter("dab", 3);
    } else {
      addLog("Dab rush active: repair speed boosted for a short window.");
      queueBanter("dab", 2);
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
            queueBanter("thing", 2);
            return;
          }
          car.remainingRepairMs = Math.max(500, car.remainingRepairMs * 0.45);
          addLog(`Arcane thing performed: ${car.name} repair progress surges.`);
        },
      },
    ];

    const chosen = weightedPick(outcomes, (entry) => entry.weight);
    chosen.apply();
    queueBanter("thing", 2);
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
    queueBanter("puke_start", 3);
    playTone("warn");
  }

  function resolvePukeEvent(success) {
    if (success) {
      state.score = Math.max(0, state.score - 40);
      state.timeMs += TUNING.PUKE_SUCCESS_TIME_PENALTY_MS;
      removeBac(0.16);
      state.pukeRisk = clamp(state.pukeRisk - 55, 0, TUNING.PUKERISK_MAX);
      addLog("Crisis managed. Minor dignity loss.");
      queueBanter("puke_success", 2);
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
      queueBanter("puke_fail", 3);
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
    queueBanter("ko", 4);
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
    state.results = buildResults();
    renderResultsModal();
    addLog(`Shift over. Final score: ${state.score}.`);
    openModal("results");
    maybeOpenHighScoreEntry();
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
    const prevTier = state.streakTier;
    if (inSweetSpot) {
      state.streakMs += stepMs;
      state.streakTier = Math.floor(state.streakMs / TUNING.STREAK_STEP_MS);
      state.streakBestSeconds = Math.max(state.streakBestSeconds, Math.floor(state.streakMs / 1000));
      queueBanter("streak_tick", 0.5);
      if (state.streakTier > prevTier) queueBanter("streak_milestone", 2);
    } else if (state.streakMs > 0) {
      state.streakMs = 0;
      state.streakTier = 0;
      queueBanter("streak_break", 1);
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
        queueBanter("streak_break", 1);
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
    updateBodieVoice(state.timeMs, stepMs);
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
      queueBanter("start_drink", 1);
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
    queueBanter(state.paused ? "streak_break" : "streak_start", 1);
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
      "escape",
    ]);
    if (handled.has(key)) {
      event.preventDefault();
    }
    if (key === "escape") {
      if (state.activeModal) {
        if (state.pendingHighScoreEntry && state.activeModal === "newHighScore") {
          openModal("results");
        } else {
          closeAllModals();
        }
      }
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
    window.addEventListener("resize", applyLayoutState);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", applyLayoutState);
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

    const tapAndRun = (button, fn) => {
      button.addEventListener("click", () => {
        ensureAudioContext();
        animateTapFeedback(button);
        fn();
      });
    };

    tapAndRun(ui.pauseBtn, togglePause);
    tapAndRun(ui.resetBtn, () => resetRun(false));
    tapAndRun(ui.openHighScoresBtn, () => {
      renderHighScoresTable();
      openModal("highscores");
    });
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
      applyLayoutState();
    });

    ui.banterToggle.addEventListener("click", () => {
      state.settings.bodieBanter = !state.settings.bodieBanter;
      saveSettings();
    });

    ui.banterFrequencyToggle.addEventListener("click", () => {
      const order = ["low", "normal", "high"];
      const idx = order.indexOf(state.settings.banterFrequency);
      state.settings.banterFrequency = order[(idx + 1) % order.length];
      saveSettings();
    });

    tapAndRun(ui.drinkBtn, startDrink);
    tapAndRun(ui.fixBtn, startRepair);
    tapAndRun(ui.cancelRepairBtn, cancelRepair);
    tapAndRun(ui.cigBtn, () => startBonus("cigarette"));
    tapAndRun(ui.dabBtn, () => startBonus("dab"));
    tapAndRun(ui.thingBtn, () => startBonus("thing"));

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

    const onCarTap = (event) => {
      const target = event.target.closest("[data-car-id]");
      if (!target) return;
      const id = Number(target.dataset.carId);
      if (!Number.isFinite(id)) return;
      state.selectedCarId = id;
      queueBanter("car_selected", 1);
    };
    ui.carQueue.addEventListener("click", onCarTap);

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

    ui.resultsPlayAgainBtn.addEventListener("click", () => resetRun(false));
    ui.resultsHighScoresBtn.addEventListener("click", () => {
      renderHighScoresTable();
      openModal("highscores");
    });
    ui.resultsShareBtn.addEventListener("click", () => {
      shareScore();
    });
    ui.resultsCloseBtn.addEventListener("click", closeAllModals);
    ui.highScoresCloseBtn.addEventListener("click", closeAllModals);
    ui.newHighScoreCloseBtn.addEventListener("click", () => {
      if (state.pendingHighScoreEntry) {
        openModal("results");
      } else {
        closeAllModals();
      }
    });
    ui.saveHighScoreBtn.addEventListener("click", savePendingHighScore);
    ui.highScoreNameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        savePendingHighScore();
      }
    });
    ui.resetHighScoresBtn.addEventListener("click", () => {
      if (!confirm("Reset all local high scores?")) return;
      state.highScores = [];
      saveHighScoreList();
      renderHighScoresTable();
      showToast("High scores reset.");
    });
    ui.shareBannerClose.addEventListener("click", () => ui.shareBanner.classList.add("hidden"));
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
  }

  function renderLogs() {
    const signature = state.logs.map((entry) => `${entry.source}:${entry.kind}:${entry.stage}:${entry.text}`).join("|");
    if (signature === lastLogSignature) return;
    ui.logFeed.innerHTML = state.logs
      .map((entry) => {
        const classes = ["log-line"];
        if (entry.source === "bodie") {
          classes.push("bodie");
          if (Number.isFinite(entry.stage)) {
            classes.push(`stage-${entry.stage}`);
          }
        }
        return `<li class="${classes.join(" ")}"><em>${entry.text}</em></li>`;
      })
      .join("");
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
      ui.eventOverlay.classList.add("hidden");
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

    ui.pauseBtn.textContent = state.paused ? "Resume (P)" : "Pause (P)";

    ui.soundToggle.textContent = state.settings.soundOn ? "Sound: On" : "Sound: Off";
    ui.soundToggle.setAttribute("aria-pressed", String(state.settings.soundOn));

    const compactText = state.settings.compactMode === "on" ? "Compact: On" : state.settings.compactMode === "off" ? "Compact: Off" : "Compact: Auto";
    ui.compactModeToggle.textContent = compactText;
    ui.compactModeToggle.setAttribute("aria-pressed", String(getCompactModeEnabled()));
    ui.banterToggle.textContent = `Bodie Banter: ${state.settings.bodieBanter ? "On" : "Off"}`;
    ui.banterToggle.setAttribute("aria-pressed", String(state.settings.bodieBanter));
    const freqLabel = state.settings.banterFrequency.charAt(0).toUpperCase() + state.settings.banterFrequency.slice(1);
    ui.banterFrequencyToggle.textContent = `Banter Frequency: ${freqLabel}`;
    ui.banterFrequencyToggle.setAttribute("aria-pressed", String(state.settings.banterFrequency === "high"));
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
    const motionScale = reduceMotion ? 0.2 : 1;
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
      tick(delta);
      render();
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
      recent_logs: state.logs.slice(0, 6).map((entry) => entry.text),
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
  renderHighScoresTable();
  handleShareBannerFromUrl();
  setupMotionPreferenceListener();
  applyLayoutState();
  resetRun(true);
  bindEvents();
  startLoop();
  render();
})();
