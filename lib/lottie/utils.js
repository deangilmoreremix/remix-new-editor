export const download = (json, jsonName) => {
  const uri = `data:text/json;charset=utf-8,${json}`;

  const link = document.createElement('a');

  link.setAttribute('href', encodeURI(uri));
  link.setAttribute('download', jsonName);

  link.click();
};

export const fade = (color, opacity = 0.4) => {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const getDimensions = (json) => {
  if (!json) return null;

  const { w: width, h: height } = json;
  return { width, height, ratio: width / height };
};

// main algorithm, it executes a callback on every color it finds
export const getColors = (tree, cb, asset = -1) => {
  if (tree) {
    tree.forEach((layer, i) => {
      if (layer.shapes) {
        layer.shapes.forEach((shape, j) => {
          if (shape.it) {
            shape.it.forEach((prop, k) => {
              if (['fl', 'st'].includes(prop.ty)) {
                const color = prop.c.k;

                // eslint-disable-next-line
                let [r, g, b, a] = color;

                r = fromUnitVector(r);
                g = fromUnitVector(g);
                b = fromUnitVector(b);


                const meta = {
                  i, // layer index
                  j, // shape index
                  k, // prop index
                  r, // red
                  g, // green
                  b, // blue
                  a, // alpha
                  nm: prop.nm,
                  asset,
                  color: rgbToHex(r, g, b),
                };

                if (cb) cb(meta);
              }
            });
          }
        });
      }
    });
  }
};

export const hexToRgb = (hex) => {
  const rgb = hexToComponents(hex);

  return rgb
    ? {
      r: parseInt(rgb[1], 16),
      g: parseInt(rgb[2], 16),
      b: parseInt(rgb[3], 16),
    }
    : {
      r: 0,
      g: 0,
      b: 0,
    };
};

export const invert = (hex) => {
  const rgb = hexToComponents(hex);

  const { r, g, b } = rgb
    ? {
      r: 255 - parseInt(rgb[1], 16),
      g: 255 - parseInt(rgb[2], 16),
      b: 255 - parseInt(rgb[3], 16),
    }
    : {
      r: 1,
      g: 1,
      b: 1,
    };

  return rgbToHex(r, g, b);
};

export const toUnitVector = (n) => Math.round((n / 255) * 1000) / 1000;

const fromUnitVector = (n) => Math.round(n * 255);

const rgbToHex = (r, g, b) => `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;

const hexToComponents = (hex) => /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

const componentToHex = (c) => {
  const hex = c.toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
};
