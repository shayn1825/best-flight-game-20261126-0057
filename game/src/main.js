// Nusa Sky Courier — the game loop and the state machine.
// Title → briefing → flying → debrief / crash → next mission → campaign.
// The loop steps the flight model at a fixed 60 Hz so the game plays the
// same on any machine, then draws the world, the HUD and the menus.

import { VIEW } from './config.js';
import { buildTerrainMap, buildClouds, terrainHeight } from './terrain.js';
import { createFlight, stepFlight } from './flight.js';
import {
  createMissionState,
  startMission,
  updateMission,
  MISSIONS,
} from './missions.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import {
  drawHud,
  drawTitle,
  drawBriefing,
  drawDebrief,
  drawCrash,
  drawCampaignComplete,
  drawPaused,
} from './hud.js';
import { applyShotScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const terrainMap = buildTerrainMap();
const clouds = buildClouds();
const renderer = createRenderer(terrainMap, clouds);
const input = createInput(canvas);
const audio = createAudio();

const game = {
  state: 'title', // title | briefing | flying | paused | debrief | crash | campaign | gameover
  view: 'chase', // chase | cockpit
  flight: createFlight(),
  missionState: createMissionState(),
  mission: MISSIONS[0],
  lives: 3,
  toasts: [],
  time: 0,
  terrainMap,
  audio,
  muted: false,
};

function addToast(text, seconds) {
  game.toasts.push({ text, life: seconds || 2.6 });
  if (game.toasts.length > 3) game.toasts.shift();
}

game.startBriefing = function startBriefing() {
  audio.start();
  game.state = 'briefing';
};

game.startFlying = function startFlying() {
  audio.start();
  game.beginMission(game.missionState.index);
  game.state = 'flying';
};

game.beginMission = function beginMission(index) {
  const mission = startMission(game.missionState, index);
  game.mission = mission;
  const start = mission.start;
  const flight = game.flight;
  flight.x = start.x;
  flight.y = start.y;
  flight.heading = (start.headingDeg * Math.PI) / 180;
  flight.altitude = start.altitude;
  flight.speed = start.speed;
  flight.throttle = start.throttle;
  flight.pitch = 0;
  flight.bank = 0;
  flight.fuel = mission.fuel;
  flight.damage = 0;
  flight.gearDown = true;
  flight.flapsDown = false;
  flight.verticalSpeed = 0;
  flight.onGround = start.onGround;
  flight.crashed = false;
  flight.landed = false;
  flight.landedRunway = null;
  flight.stalled = false;
  flight.engineOut = false;
  game.toasts = [];
  addToast(`${mission.name} — ${mission.subtitle}`, 3.2);
};

game.nextMission = function nextMission() {
  if (game.mission.number >= MISSIONS.length) {
    game.state = 'campaign';
    localStorage.setItem(
      'nusa-sky-courier-best',
      String(Math.max(Number(localStorage.getItem('nusa-sky-courier-best') || 0), game.missionState.score)),
    );
    audio.fanfare();
    return;
  }
  game.missionState.index += 1;
  game.state = 'briefing';
};

game.retryMission = function retryMission() {
  game.beginMission(game.missionState.index);
  game.state = 'flying';
};

game.restartCampaign = function restartCampaign() {
  game.lives = 3;
  game.missionState = createMissionState();
  game.beginMission(0);
  game.state = 'briefing';
};

game.togglePause = function togglePause() {
  if (game.state === 'flying') game.state = 'paused';
  else if (game.state === 'paused') game.state = 'flying';
};

function handleCrash() {
  game.lives -= 1;
  audio.thud();
  if (game.lives <= 0) {
    game.state = 'crash';
  } else {
    game.state = 'crash';
  }
}

// --- The fixed-step loop ---------------------------------------------------
let lastTime = performance.now();
let accumulator = 0;
const STEP = 1 / 60;
let framesRendered = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  game.time += elapsed;

  input.clearButtons();
  input.applyDragSteering(VIEW.width, VIEW.height);

  // One-shot keys.
  if (input.keys.has('KeyG') && !game._gPressed) {
    game.flight.gearDown = !game.flight.gearDown;
    game._gPressed = true;
  }
  if (!input.keys.has('KeyG')) game._gPressed = false;
  if (input.keys.has('KeyF') && !game._fPressed) {
    game.flight.flapsDown = !game.flight.flapsDown;
    game._fPressed = true;
  }
  if (!input.keys.has('KeyF')) game._fPressed = false;
  if (input.keys.has('KeyC') && !game._cPressed) {
    game.view = game.view === 'chase' ? 'cockpit' : 'chase';
    game._cPressed = true;
  }
  if (!input.keys.has('KeyC')) game._cPressed = false;
  if (input.keys.has('KeyP') && !game._pPressed) {
    game.togglePause();
    game._pPressed = true;
  }
  if (!input.keys.has('KeyP')) game._pPressed = false;
  if (input.keys.has('Enter') && !game._enterPressed) {
    game._enterPressed = true;
    if (game.state === 'title') game.startBriefing();
    else if (game.state === 'briefing') game.startFlying();
    else if (game.state === 'debrief') game.nextMission();
    else if (game.state === 'crash') game.retryMission();
    else if (game.state === 'campaign') game.restartCampaign();
  }
  if (!input.keys.has('Enter')) game._enterPressed = false;
  if (input.keys.has('KeyM') && !game._mPressed) {
    audio.toggleMute();
    game._mPressed = true;
  }
  if (!input.keys.has('KeyM')) game._mPressed = false;

  if (game.state === 'flying') {
    accumulator += elapsed;
    let steps = 0;
    const ringsBefore = game.missionState.ringsPassed;
    const wasLanded = game.flight.landed;
    while (accumulator >= STEP && steps < 5) {
      // Storm wind pushes the plane sideways in mission 3.
      if (game.mission.wind) {
        game.flight.x += Math.sin(game.time * 0.7) * 2.4 * STEP;
      }
      stepFlight(game.flight, input, STEP);
      updateMission(game.missionState, game.flight, STEP);
      accumulator -= STEP;
      steps += 1;
    }
    if (game.missionState.ringsPassed > ringsBefore) {
      addToast(`CINCIN ${game.missionState.ringsPassed}/${game.missionState.rings.length}  +${100 + Math.round(game.flight.speed)}`, 2.2);
      audio.ringChime();
    }
    if (game.flight.landed && !wasLanded && game.mission.landAt) {
      addToast('MENDARAT!', 2.6);
      audio.thud();
    }
    if (game.flight.stalled && Math.random() < 0.02) audio.alarm();
    if (game.missionState.complete) {
      game.state = 'debrief';
      audio.fanfare();
    } else if (game.missionState.failed) {
      handleCrash();
    }
    // Clouds drift with the wind.
    for (const cloud of clouds) {
      cloud.x += cloud.drift * elapsed;
      if (cloud.x > 5900) cloud.x = 100;
    }
    audio.update(game.flight.throttle, game.flight.speed, true);
  } else {
    audio.update(0, 0, false);
  }

  // Toasts age out.
  game.toasts.forEach((toast) => { toast.life -= elapsed; });
  game.toasts = game.toasts.filter((toast) => toast.life > 0);

  // --- Draw ---------------------------------------------------------------
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  if (game.state === 'title') {
    renderer.render(ctx, game, game.time);
    drawTitle(ctx, game, input);
  } else if (game.state === 'briefing') {
    renderer.render(ctx, game, game.time);
    drawBriefing(ctx, game, input);
  } else if (game.state === 'flying' || game.state === 'paused') {
    renderer.render(ctx, game, game.time);
    drawHud(ctx, game, input);
    if (game.state === 'paused') drawPaused(ctx, game, input);
  } else if (game.state === 'debrief') {
    renderer.render(ctx, game, game.time);
    drawDebrief(ctx, game, input);
  } else if (game.state === 'crash') {
    renderer.render(ctx, game, game.time);
    drawCrash(ctx, game, input);
  } else if (game.state === 'campaign') {
    renderer.render(ctx, game, game.time);
    drawCampaignComplete(ctx, game, input);
  }
  input.consumeClick();

  framesRendered += 1;
  if (framesRendered === 3) {
    window.__nusaReady = true;
  }
}

// Screenshot scenes (?scene=cover|cockpit|landing|win) pose the real game.
const params = new URLSearchParams(window.location.search);
const scene = params.get('scene');
if (scene) {
  applyShotScene(game, scene);
} else {
  game.beginMission(0);
  // Title backdrop: the plane already airborne over the islands.
  game.flight.x = 2100;
  game.flight.y = 4100;
  game.flight.heading = (18 * Math.PI) / 180;
  game.flight.altitude = 260;
  game.flight.speed = 56;
  game.flight.throttle = 0.7;
  game.flight.onGround = false;
  game.flight.gearDown = false;
}

window.NUSA = {
  game,
  input,
  version: '1.0.0',
  terrainHeight,
  MISSIONS,
};

requestAnimationFrame(frame);
