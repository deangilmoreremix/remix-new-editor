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
