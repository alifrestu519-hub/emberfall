// Keyboard and mouse, read as one bitmask of actions per frame.
// Clicks plant and pick; 1-6 choose a growth; Space starts the next wave
// early; F fast-forwards; P or Escape pauses; R restarts; M mutes;
// U upgrades the selected growth, X sells it; T returns to the title.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_START_WAVE = 16;
export const ACTION_SPEED = 32;
export const ACTION_REROLL = 64;
export const ACTION_SAME_SEED = 128;
export const ACTION_UPGRADE = 256;
export const ACTION_SELL = 512;
export const ACTION_TITLE = 1024;
export const ACTION_PICK_1 = 2048;
export const ACTION_PICK_2 = 4096;
export const ACTION_PICK_3 = 8192;
export const ACTION_PICK_4 = 16384;
export const ACTION_PICK_5 = 32768;
export const ACTION_PICK_6 = 65536;
export const ACTION_DESELECT = 131072;

export const PICK_ACTIONS = [
  ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3,
  ACTION_PICK_4, ACTION_PICK_5, ACTION_PICK_6,
];

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyR: ACTION_RESTART,
  KeyM: ACTION_MUTE,
  Space: ACTION_START_WAVE,
  KeyF: ACTION_SPEED,
  KeyG: ACTION_REROLL,
  KeyS: ACTION_SAME_SEED,
  KeyU: ACTION_UPGRADE,
  KeyX: ACTION_SELL,
  KeyT: ACTION_TITLE,
  Digit1: ACTION_PICK_1,
  Digit2: ACTION_PICK_2,
  Digit3: ACTION_PICK_3,
  Digit4: ACTION_PICK_4,
  Digit5: ACTION_PICK_5,
  Digit6: ACTION_PICK_6,
  Numpad1: ACTION_PICK_1,
  Numpad2: ACTION_PICK_2,
  Numpad3: ACTION_PICK_3,
  Numpad4: ACTION_PICK_4,
  Numpad5: ACTION_PICK_5,
  Numpad6: ACTION_PICK_6,
};

export function createInput(canvas) {
  let actions = 0;
  const mouse = { x: 640, y: 360, clicked: false, rightClicked: false };

  function toGame(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 1280,
      y: ((clientY - rect.top) / rect.height) * 720,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') event.preventDefault();
    if (event.repeat) return;
    const action = KEY_ACTIONS[event.code];
    if (action) actions |= action;
  });
  canvas.addEventListener('pointermove', (event) => {
    const p = toGame(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = toGame(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    if (event.button === 2) mouse.rightClicked = true;
    else mouse.clicked = true;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse() {
      return mouse;
    },
    /** Actions pressed since the last call; each press is reported once. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** True only on the frame the mouse was clicked. */
    takeClick() {
      const clicked = mouse.clicked;
      mouse.clicked = false;
      return clicked;
    },
    /** True only on the frame the right mouse button was clicked. */
    takeRightClick() {
      const clicked = mouse.rightClicked;
      mouse.rightClicked = false;
      return clicked;
    },
  };
}
