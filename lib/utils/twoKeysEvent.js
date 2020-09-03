export const twoKeysEvent = ({ callBack, codes = [] }) => {
  const pressed = new Set();

  const actionFunc = event => {
    pressed.add(event.keyCode);

    // Are all of the keys pressed?
    // eslint-disable-next-line no-restricted-syntax
    for (const code of codes) {
      if (!pressed.has(code)) {
        return;
      }
    }
    event.preventDefault();
    pressed.clear();
    callBack();
  };

  const pressedDelete = event => {
    pressed.delete(event.keyCode);
  };

  document.addEventListener('keydown', actionFunc);
  document.addEventListener('keyup', pressedDelete);
};
