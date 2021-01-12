import React, { useState } from 'react';
import TextField from '@material-ui/core/TextField';
import Autocomplete from '@material-ui/lab/Autocomplete';
import CircularProgress from '@material-ui/core/CircularProgress';
import FormGroup from '@material-ui/core/FormGroup';
import InputLabel from '@material-ui/core/InputLabel';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

import { CLEAR, REMOVE_VALUE, SELECT_OPTION } from '../../lib/constants/actions';
import useProjectStore from '../hooks/useProjectStore';

const autocompleteClasses = {
  root: 'autocomplete',
  tag: 'autocomplete-input-tag',
  input: 'autocomplete-input-tag-placeholder',
  inputRoot: 'autocomplete-input',
  endAdornment: 'action-icons',
  clearIndicator: 'clear-icon',
  popupIndicator: 'popup-icon',
  listbox: 'listbox-content',
  focused: 'autocomplete-focus',
};

const AutoCompleteSelect = React.forwardRef((
  {
    clear,
    removeInput,
    addInput,
    items,
    label,
    perPage = 30,
    path,
  }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const { getList } = useProjectStore();
  const isLoading = open && options.length === 0;

  React.useEffect(() => {
    if (!isLoading) {
      return;
    }
    (async () => {
      const resp = await getList({ perPage, path });
      setOptions(resp);
    })();
  }, [isLoading]);

  React.useEffect(() => {
    if (!open) {
      setOptions([]);
    }
  }, [open]);

  const handleChange = async (e) => {
    const resp = await getList({ query: e.target.value, perPage, path });
    setOptions(resp);
  };

  const handleItemChange = (e, selectedArray, reason, { option } = {}) => {
    if (e.type === 'blur') {
      return;
    }
    switch (reason) {
      case CLEAR:
        return clear();
      case SELECT_OPTION:
        return addInput({ _id: option._id, name: option.name });
      case REMOVE_VALUE:
        return removeInput(option._id);
      default:
        return null;
    }
  };

  return (
    <FormGroup
      classes={{
        root: 'autocomplete-container',
      }}
    >
      {
        label && (
          <InputLabel key="label-key" className={classnames('form-control-label')}>
            {label}
          </InputLabel>
        )
      }
      <Autocomplete
        value={items}
        multiple
        autoSelect
        autoHighlight
        open={open}
        onChange={handleItemChange}
        onOpen={() => {
          setOpen(true);
        }}
        limitTags={10}
        onClose={() => {
          setOpen(false);
        }}
        classes={{
          root: autocompleteClasses.root,
          tag: autocompleteClasses.tag,
          input: autocompleteClasses.input,
          inputRoot: autocompleteClasses.inputRoot,
          endAdornment: autocompleteClasses.endAdornment,
          clearIndicator: autocompleteClasses.clearIndicator,
          popupIndicator: autocompleteClasses.popupIndicator,
          listbox: autocompleteClasses.listbox,
          focused: autocompleteClasses.focused,
        }}
        getOptionSelected={(option, value) => option.name === value.name}
        getOptionLabel={(option) => option.name}
        options={options}
        loading={isLoading}
        renderInput={(params) => (
          <TextField
            {...params}
            classes={{
              root: 'input-container',
            }}
            variant="outlined"
            placeholder="Search"
            onChange={handleChange}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <React.Fragment>
                  {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </React.Fragment>
              ),
            }}
          />
        )}
      />
    </FormGroup>

  );
});

AutoCompleteSelect.propTypes = {
  label: PropTypes.string,
  perPage: PropTypes.number,
  path: PropTypes.string.isRequired,
  clear: PropTypes.func,
  addInput: PropTypes.func,
  removeInput: PropTypes.func,
  items: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  })),
};

export default AutoCompleteSelect;
