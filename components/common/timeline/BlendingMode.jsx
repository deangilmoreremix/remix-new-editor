import React, { useState } from 'react';

import blendMode from '../../../lib/constants/blendMode';

import FormSelect from '../../form/FormSelect';

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
