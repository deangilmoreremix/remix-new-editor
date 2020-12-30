import React, { useState } from 'react';
import TextField from '@material-ui/core/TextField';
import Autocomplete from '@material-ui/lab/Autocomplete';
import CircularProgress from '@material-ui/core/CircularProgress';
import FormGroup from '@material-ui/core/FormGroup';
import InputLabel from '@material-ui/core/InputLabel';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const AutoCompleteSelect = React.forwardRef((
  {
    getCategories,
    clear,
    removeInput,
    addInput,
    categories,
    label,
  }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const loading = open && options.length === 0;

  React.useEffect(() => {
    let active = true;

    if (!loading) {
      return undefined;
    }

    (async () => {
      const resp = await getCategories();

      if (active) {
        setOptions(resp.map((category) => category));
      }
    })();

    return () => {
      active = false;
    };
  }, [loading]);

  React.useEffect(() => {
    if (!open) {
      setOptions([]);
    }
  }, [open]);

  const handleChange = async (e) => {
    const resp = await getCategories(e.target.value);
    setOptions(resp.map((category) => category));
  };

  const handleTestChange = (e, selectedArray, reason, { option } = {}) => {
    if (e.type === 'blur') {
      return;
    }
    switch (reason) {
      case 'clear':
        return clear();
      case 'select-option':
        return addInput({ _id: option._id, name: option.name });
      case 'remove-option':
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
        value={categories}
        multiple
        autoSelect
        autoHighlight
        style={{ width: 300 }}
        open={open}
        onChange={handleTestChange}
        onOpen={() => {
          setOpen(true);
        }}
        limitTags={3}
        onClose={() => {
          setOpen(false);
        }}
        classes={{
          root: 'autocomplete',
          tag: 'autocomplete-input-tag',
          input: 'autocomplete-input-tag-placeholder',
          inputRoot: 'autocomplete-input',
          endAdornment: 'action-icons',
          clearIndicator: 'clear-icon',
          popupIndicator: 'popup-icon',
          listbox: 'listbox-content',
          focused: 'autocomplete-focus',
        }}
        getOptionSelected={(option, value) => option.name === value.name}
        getOptionLabel={(option) => option.name}
        options={options}
        loading={loading}
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
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
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
  getCategories: PropTypes.func,
  clear: PropTypes.func,
  addInput: PropTypes.func,
  removeInput: PropTypes.func,
  categories: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  })),
};

export default AutoCompleteSelect;
