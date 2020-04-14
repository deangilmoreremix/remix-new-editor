import { OFF, ON } from '../constants/popcorn';

export function getFormFields(type) {
  const { options } = this.manifest[type];
  let result = {};
  if (options) {
    Object.keys(options).forEach(fieldName => {
      if (!options[fieldName].hidden) {
        result[fieldName] = options[fieldName];
      }
    });
  }

  return result;
}

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
  container.classList.add(ON);
  container.classList.remove(OFF);
};

export const off = (container) => {
  container.classList.remove(ON);
  container.classList.add(OFF);
};
