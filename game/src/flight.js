// The flight model: a small prop plane with real trade-offs.
// Throttle buys speed, speed buys lift, banking buys turns, and fuel
// buys none of it for free. Stall, overspeed, hard landings and terrain
// are all checked here, so the renderer only ever draws the truth.

import { PLANE } from './config.js';
import { clamp, angleDifference } from './random.js';
import { terrainHeight, runwayAt, surfaceAt } from './terrain.js';

export function createFlight() {
  return {
    x: 1500, y: 4900, // metres, world coords (starts south of runway Merpati)
    heading: 0, // radians, 0 = north
    altitude: 0, // metres above sea level
    speed: 0, // m/s
    pitch: 0, // degrees, + = nose up
    bank: 0, // degrees, + = right wing down
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    gearDown: true,
    flapsDown: false,
    verticalSpeed: 0,
    onGround: true,
    crashed: false,
    landed: false,
    landedRunway: null,
    stalled: false,
    overspeed: false,
    engineOut: false,
    touchdownRate: 0,
  };
}

// How steep the ground is under the plane: the steepest rise over run in
// any direction. A gentle field is landable; a mountainside is not —
// measured in every direction, since flying along a contour can hide it.
function groundSlope(flight) {
  const fx = Math.sin(flight.heading);
  const fy = -Math.cos(flight.heading);
  const ahead = terrainHeight(flight.x + fx * 25, flight.y + fy * 25);
  const behind = terrainHeight(flight.x - fx * 25, flight.y - fy * 25);
  const left = terrainHeight(flight.x + fy * 25, flight.y - fx * 25);
  const right = terrainHeight(flight.x - fy * 25, flight.y + fx * 25);
  const along = Math.abs(ahead - behind) / 50;
  const across = Math.abs(left - right) / 50;
  return Math.max(along, across);
}

export function stepFlight(flight, input, dt) {
  if (flight.crashed) return;

  // --- Throttle -----------------------------------------------------------
  let throttleTarget = flight.throttle;
  if (input.throttleUp) throttleTarget += PLANE.throttleRate * dt;
  if (input.throttleDown) throttleTarget -= PLANE.throttleRate * dt;
  if (input.throttleSet !== null && input.throttleSet !== undefined) {
    throttleTarget = input.throttleSet;
  }
  flight.throttle = clamp(throttleTarget, 0, PLANE.maxThrottle);
  if (flight.fuel <= 0) {
    flight.throttle = 0;
    flight.engineOut = true;
  }

  // --- Pitch and bank from the stick --------------------------------------
  const pitchTarget = input.pitchUp
    ? PLANE.maxPitchUp
    : input.pitchDown
      ? PLANE.maxPitchDown
      : 0;
  const pitchRate = input.pitchUp || input.pitchDown ? PLANE.pitchRate : PLANE.pitchRate * 1.6;
  flight.pitch += clamp(pitchTarget - flight.pitch, -pitchRate * dt, pitchRate * dt);

  const bankTarget = input.bankLeft
    ? -PLANE.maxBank
    : input.bankRight
      ? PLANE.maxBank
      : 0;
  flight.bank += clamp(bankTarget - flight.bank, -PLANE.bankRate * dt, PLANE.bankRate * dt);

  // --- Speed: thrust vs drag, climbing bleeds speed -----------------------
  const stall = flight.flapsDown ? PLANE.stallSpeedFlaps : PLANE.stallSpeed;
  let topSpeed = PLANE.cruiseSpeed + flight.throttle * 30;
  if (flight.gearDown) topSpeed -= PLANE.gearDrag;
  if (flight.flapsDown) topSpeed -= PLANE.flapDrag;
  const climbPenalty = Math.max(0, flight.pitch) * 0.55;
  const targetSpeed = Math.max(0, topSpeed - climbPenalty);
  const accel = flight.onGround ? 14 : 9;
  flight.speed += clamp(targetSpeed - flight.speed, -accel * dt, accel * dt);
  if (!flight.onGround && flight.pitch < -6) {
    flight.speed += (-flight.pitch - 6) * 0.35 * dt; // diving picks up speed
  }

  // --- Stall: slow wing, sinking nose --------------------------------------
  flight.stalled = !flight.onGround && flight.speed < stall;
  if (flight.stalled) {
    flight.pitch = Math.max(flight.pitch - 26 * dt, PLANE.maxPitchDown);
  }

  // --- Turn: a coordinated turn, rate from bank and speed ------------------
  const bankRad = (flight.bank * Math.PI) / 180;
  const turnRate = flight.speed > 4 ? (9.81 * Math.tan(bankRad)) / flight.speed : 0;
  flight.heading += turnRate * dt;

  // --- Climb and sink ------------------------------------------------------
  const pitchRad = (flight.pitch * Math.PI) / 180;
  let vspeed = Math.sin(pitchRad) * flight.speed * PLANE.climbFactor;
  if (flight.stalled) vspeed -= PLANE.sinkRateStall;
  if (flight.onGround) vspeed = Math.max(0, vspeed);
  flight.verticalSpeed = vspeed;
  flight.altitude += vspeed * dt;

  // --- Move over the ground -------------------------------------------------
  const groundSpeed = flight.onGround ? flight.speed : flight.speed * Math.cos(pitchRad);
  flight.x += Math.sin(flight.heading) * groundSpeed * dt;
  flight.y += -Math.cos(flight.heading) * groundSpeed * dt;
  flight.x = clamp(flight.x, 80, 5920);
  flight.y = clamp(flight.y, 80, 5920);

  // --- Fuel ------------------------------------------------------------------
  if (!flight.onGround || flight.speed > 5) {
    flight.fuel = Math.max(
      0,
      flight.fuel - (PLANE.fuelBurnBase + PLANE.fuelBurnThrottle * flight.throttle) * dt,
    );
  }

  // --- Takeoff and touchdown -------------------------------------------------
  const ground = terrainHeight(flight.x, flight.y);
  if (flight.onGround) {
    // Rotate and lift off once the wing has enough speed.
    if (flight.speed > stall + 4 && flight.pitch > 4) {
      flight.onGround = false;
      flight.landed = false;
    } else {
      flight.altitude = ground;
    }
  }
  if (!flight.onGround && flight.altitude <= ground) {
    const strip = runwayAt(flight.x, flight.y);
    const gentle = flight.verticalSpeed > -4.5 && flight.speed < 52;
    const aligned = strip
      ? Math.abs(angleDifference(flight.heading, (strip.runway.headingDeg * Math.PI) / 180)) < 0.5 ||
        Math.abs(angleDifference(flight.heading, ((strip.runway.headingDeg + 180) * Math.PI) / 180)) < 0.5
      : false;
    flight.touchdownRate = flight.verticalSpeed;
    if (strip && gentle && flight.gearDown && aligned) {
      // A landing: roll out on the strip.
      flight.onGround = true;
      flight.altitude = ground;
      flight.landed = true;
      flight.landedRunway = strip.runway.id;
      flight.pitch = 0;
      flight.bank = 0;
      if (flight.verticalSpeed < -3) flight.damage += PLANE.damageHardLanding * 0.4;
    } else if (strip && gentle && !flight.gearDown) {
      // Belly landing: survives, but it costs the airframe.
      flight.onGround = true;
      flight.altitude = ground;
      flight.landed = true;
      flight.landedRunway = strip.runway.id;
      flight.damage += PLANE.damageHardLanding;
      flight.pitch = 0;
      flight.bank = 0;
    } else if (gentle && surfaceAt(flight.x, flight.y) === 'land' && groundSlope(flight) < 0.15) {
      // A rough field landing on gentle ground: the plane survives, the
      // airframe complains, and the pilot can take off again — but no
      // runway, no delivery. A steep slope is still a crash.
      flight.onGround = true;
      flight.altitude = ground;
      flight.landed = true;
      flight.landedRunway = null;
      flight.damage += PLANE.damageHardLanding;
      flight.pitch = 0;
      flight.bank = 0;
    } else {
      // Water, a hillside, a building-speed impact, or a gear-up slam: crash.
      flight.crashed = true;
      flight.damage = 100;
      flight.altitude = ground;
    }
  }

  // Rolling on the ground: light resistance under power so the plane can
  // accelerate to takeoff speed, firm braking when the throttle is idle.
  // (Never zero the speed outright: a fresh takeoff roll builds it a
  // fraction of a metre per second at a time.)
  if (flight.onGround) {
    const rollingDrag = flight.throttle > 0.15 ? 2 : 10;
    flight.speed = Math.max(0, flight.speed - rollingDrag * dt);
  }

  flight.overspeed = flight.speed > PLANE.maxSpeed;
  if (flight.damage >= 100) flight.crashed = true;
}
