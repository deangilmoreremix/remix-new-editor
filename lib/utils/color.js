export const parseRgbaString = (rgba) => {
  const rgbaRegexp = new RegExp(/\((\s*?.*?)*?\)/, 'i');
  if (!rgba) {
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  rgba = rgba.replace(/\s/g, '');
  if (!rgbaRegexp.test(rgba)) {
    return rgba;
  }
  const components = rgba.split('(')[1].split(')')[0].split(',');
  return {
    r: +components[0],
    g: +components[1],
    b: +components[2],
    a: +components[3],
  };
};

export const colorToRgbaString = ({ r, g, b, a }) => r && g && b && `rgb(${r}, ${g}, ${b}, ${a || 1})`;
