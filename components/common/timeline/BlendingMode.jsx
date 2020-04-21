import React, { useState } from 'react';
import FormSelect from '../../form/FormSelect';

const blendMode = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' },
];

const BlendingMode = () => {
  const [value, setValue] = useState(blendMode[0]);
  const onChange = (inputValue) => {
    Object.keys(blendMode).forEach(item => {
      if (item.value === inputValue) {
        setValue(item);
      }
    });
  };

  return (
    <FormSelect
      items={blendMode}
      value={value}
      className="blend-mode-select"
      onChange={onChange}
    />
  );
};

export default BlendingMode;
