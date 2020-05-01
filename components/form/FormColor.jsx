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

const FormColor = ({ label, onChange, value, className, disabled }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [color, setColor] = useState('');
  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

  const colorPrimary = 'rgb(235, 80, 84, 1)';

  const changeColor = (res) => {
    onChange(res);
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    changeColor(colorToRgbaString(color));
    setAnchorEl(null);
  };

  const updateColor = (res) => {
    const parsedColor = parseRgbaString(res);
    setColor(parsedColor || parsedColor.rgb || colorPrimary);
  };

  return (
    <FormGroup className={className}>
      <Box>
        <FormLabel key="label-key" className="form-control-label">{label}</FormLabel>
      </Box>
      <Box tabIndex={-1}>
        <FormTextField
          labelClass="label-left"
          value={value || colorPrimary}
          onChange={updateColor}
          disabled={disabled}
          inputClassName={classnames({ 'input-disabled': disabled })}
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
            onChange={(r) => updateColor(colorToRgbaString(r.rgb))}
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
