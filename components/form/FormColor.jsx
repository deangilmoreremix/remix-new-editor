import React, { useState } from 'react';
import FormGroup from '@material-ui/core/FormGroup';
import FormLabel from '@material-ui/core/FormLabel';
import Box from '@material-ui/core/Box';
import Popover from '@material-ui/core/Popover';
import { ChromePicker } from 'react-color';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';
import FormTextField from './FormTextField';

const FormColor = ({ label, onChange, value: color, className }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

  const colorPrimary = 'rgb(235, 80, 84, 1)';

  const updateColor = (res) => {
    onChange(res.rgb || res || colorPrimary);
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const parseRgba = (rgba) => {
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

  return (
    <FormGroup className={className}>
      <Box>
        <FormLabel key="label-key" className="form-control-label">{label}</FormLabel>
      </Box>
      <Box tabIndex={-1}>
        <FormTextField
          labelClass="label-left"
          value={color || colorPrimary}
          onChange={updateColor}
        />
        <button
          onClick={handleClick}
          className={classnames('color-element')}
          style={{ backgroundColor: color || colorPrimary }}
        />
        <Popover
          id={id}
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <ChromePicker
            onChangeComplete={newColor => updateColor(
              `rgb(${newColor.rgb.r}, ${newColor.rgb.g}, ${newColor.rgb.b}, ${newColor.rgb.a})`,
            )}
            color={parseRgba(color)}
          />
        </Popover>
      </Box>
    </FormGroup>
  );
};
FormColor.propTypes = {
  onChange: PropTypes.func,
  label: PropTypes.string,
  value: PropTypes.string,
  className: PropTypes.string,
};

FormColor.defaultProps = {
  onChange: () => {},
};

export default FormColor;
