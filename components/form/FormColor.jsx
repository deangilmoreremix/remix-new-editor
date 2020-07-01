import React, { useState } from 'react';
import FormGroup from '@material-ui/core/FormGroup';
import FormLabel from '@material-ui/core/FormLabel';
import Box from '@material-ui/core/Box';
import Popover from '@material-ui/core/Popover';
import { ChromePicker } from 'react-color';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';
import FormTextField from './FormTextField';
import { colorToRgbaString, parseRgbaString } from '../../lib/utils/color';
import { rgba2hex, fade } from '../../lib/lottie/utils';

const FormColor = ({ label, onChange, value, className, disabled }) => {
  const colorPrimary = 'rgb(235, 80, 84, 1)';
  const [anchorEl, setAnchorEl] = useState(null);
  const [color, setColor] = useState(value || colorPrimary);
  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

  const changeColor = (newColor) => {
    if (newColor) {
      onChange(newColor);
      setColor(rgba2hex(newColor));
    }
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    changeColor(colorToRgbaString(color));
    setAnchorEl(null);
  };

  const updateColor = (newColor) => {
    if (/^#[0-9A-F]{6}$/i.test(newColor)) {
      setColor(newColor);
      onChange(fade(newColor, 1));
    } else {
      const parsedColor = parseRgbaString(colorToRgbaString(newColor.rgb));
      setColor(parsedColor || parsedColor.rgb);
    }
  };

  return (
    <FormGroup className={className}>
      <Box>
        <FormLabel key="label-key" className="form-control-label">{label}</FormLabel>
      </Box>
      <Box tabIndex={-1}>
        <FormTextField
          labelClass="label-left"
          value={colorToRgbaString(color) || value || colorPrimary}
          onChange={updateColor}
          disabled={disabled}
        />
        <button
          onClick={handleClick}
          className={classnames('color-element', { 'button-disabled': disabled })}
          style={{ backgroundColor: value || colorPrimary }}
          disabled={disabled}
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
            onChange={(r) => updateColor(r)}
            color={color}
          />
        </Popover>
      </Box>
    </FormGroup>
  );
};
FormColor.propTypes = {
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  value: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

FormColor.defaultProps = {
  disabled: false,
};

export default FormColor;
