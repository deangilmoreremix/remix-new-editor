export const addClass = (container, className) => {
  if (!container.classList.contains(className)) {
    container.classList.add(className);
  }
};
export const removeClass = (container, className) => {
  if (container.classList.contains(className)) {
    container.classList.remove(className);
  }
};

export const on = (container) => {
  container.classList.add('on');
  container.classList.remove('off');
};

export const off = (container) => {
  container.classList.remove('on');
  container.classList.add('off');
};
