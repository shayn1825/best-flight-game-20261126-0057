// Keyboard and mouse: one input state the flight model and the menus share.
// Keys are read as a held set; clicks are tested against registered buttons;
// dragging the sky steers the plane like a stick.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pitchUp: false,
    pitchDown: false,
    bankLeft: false,
    bankRight: false,
    throttleUp: false,
    throttleDown: false,
    throttleSet: null,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    dragSteer: null, // {x, y} while the pilot drags the sky
    clicked: null, // {x, y} of the last click, consumed by the UI each frame
    buttons: [], // {x, y, w, h, onClick} registered by the renderer
  };

  function updateFromKeys() {
    input.pitchUp = input.keys.has('ArrowUp') || input.keys.has('KeyI');
    input.pitchDown = input.keys.has('ArrowDown') || input.keys.has('KeyK');
    input.bankLeft = input.keys.has('ArrowLeft') || input.keys.has('KeyJ');
    input.bankRight = input.keys.has('ArrowRight') || input.keys.has('KeyL');
    input.throttleUp = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') || input.keys.has('KeyW');
    input.throttleDown = input.keys.has('ControlLeft') || input.keys.has('ControlRight') || input.keys.has('KeyS');
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      input.keys.add(event.code);
      updateFromKeys();
    }
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
    updateFromKeys();
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    updateFromKeys();
  });

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  canvas.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(event);
    input.mouseX = point.x;
    input.mouseY = point.y;
    input.mouseDown = true;
    input.clicked = point;
    // A drag that starts on open sky steers; a drag that starts on a button
    // is a click, not a steer — buttons are checked first in endFrame.
    input.dragSteer = point;
  });
  canvas.addEventListener('pointermove', (event) => {
    const point = canvasPoint(event);
    input.mouseX = point.x;
    input.mouseY = point.y;
    if (input.mouseDown && input.dragSteer) input.dragSteer = point;
  });
  canvas.addEventListener('pointerup', () => {
    input.mouseDown = false;
    input.dragSteer = null;
  });

  // Apply drag steering: the stick follows the pointer relative to centre.
  input.applyDragSteering = function applyDragSteering(width, height) {
    if (!input.dragSteer || !input.mouseDown) return;
    const dx = (input.dragSteer.x - width / 2) / (width / 2);
    const dy = (input.dragSteer.y - height / 2) / (height / 2);
    if (Math.abs(dx) > 0.12) {
      if (dx < 0) input.bankLeft = true;
      else input.bankRight = true;
    }
    if (dy < -0.12) input.pitchUp = true;
    if (dy > 0.12) input.pitchDown = true;
  };

  // Consume the pending click against this frame's buttons. Returns true
  // when a button ate the click, so the drag is not also a steer.
  input.consumeClick = function consumeClick() {
    if (!input.clicked) return false;
    const click = input.clicked;
    input.clicked = null;
    for (const button of input.buttons) {
      if (
        click.x >= button.x &&
        click.x <= button.x + button.w &&
        click.y >= button.y &&
        click.y <= button.y + button.h
      ) {
        input.dragSteer = null;
        button.onClick();
        return true;
      }
    }
    return false;
  };

  input.registerButton = function registerButton(button) {
    input.buttons.push(button);
  };

  input.clearButtons = function clearButtons() {
    input.buttons.length = 0;
  };

  input.wasPressed = function wasPressed(code) {
    return input.keys.has(code);
  };

  return input;
}
