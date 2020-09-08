import { CTRL, Z, Y, S } from '../constants/keyCodes';

export const twoKeysEvent = ({ undo, redo, saveProject }) => {
  const pressed = new Set();
  const codes = [Z, Y, S];

  const actionFunc = event => {
    pressed.add(event.keyCode);

    let key = codes.some(code => code === event.keyCode);
    if (key) {
      key = event.keyCode;
    } else {
      return null;
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const code of [CTRL, key]) {
      if (!pressed.has(code)) {
        return;
      }
    }

    event.preventDefault();

    switch (event.keyCode) {
      case Z: {
        undo();
        break;
      }
      case Y: {
        redo();
        break;
      }
      case S: {
        saveProject();
        break;
      }
      default: return null;
    }
  };

  const pressedDelete = event => {
    pressed.delete(event.keyCode);
  };

  document.addEventListener('keydown', actionFunc);
  document.addEventListener('keyup', pressedDelete);
};
