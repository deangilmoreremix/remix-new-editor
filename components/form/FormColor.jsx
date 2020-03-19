import React, { useState, useEffect, Component } from 'react';
import FormGroup from '@material-ui/core/FormGroup';
import FormLabel from '@material-ui/core/FormLabel';
import Box from '@material-ui/core/Box';
import { BlockPicker } from 'react-color';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';
import FormTextField from './FormTextField';


const FormColor = ({label, onChange,value:color}) => {

   const [showPicker, togglePicker] = useState(false);

   const colorPrimary = '#EB5054';

   const updateColor = (res) => {
     onChange(res.hex || res || colorPrimary);
   };
   const pickerClick = () => {
     togglePicker(!showPicker);
   };

     return (
       <FormGroup>
         <Box><FormLabel key="label-key" className="form-control-label">{label}</FormLabel></Box>
         <Box>
           <FormTextField
             labelClass='label-left'
             value={color || colorPrimary}
             onChange={updateColor}
           />
           <button onClick={pickerClick} className={ classnames('color-element',{'close-color-picker':showPicker})}
                style={{ backgroundColor: color || colorPrimary }}/>
           {showPicker && <BlockPicker onChange={updateColor} color={color}/>  }
         </Box>
       </FormGroup>
     );

 }
FormColor.propTypes = {
  onChange: PropTypes.func,
  label: PropTypes.string,
  value: PropTypes.string,
};

FormColor.defaultProps = {
  onChange: () => {},
};

export default FormColor
