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

  const color = React.useMemo(() => parseRgbaString(value), [value]);

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
          inputClassName={disabled && 'input-disabled'}
        />
        <button
          onClick={handleClick}
          className={classnames('color-element', `${disabled && 'button-disabled'}`)}
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
            onChangeComplete={(r) => updateColor(colorToRgbaString(r.rgb))}
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
