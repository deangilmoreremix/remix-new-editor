import React, { useState } from 'react';
import { observer } from 'mobx-react';

import { showError, showSuccess } from '../../lib/services/alertService';

import FormTextField from '../form/FormTextField';
import FormSelect from '../form/FormSelect';
import { LibrarySpinner } from '../media/Loader';

import usePresetStore from '../hooks/usePresetStore';

const types = [
  { value: 'textPreset', label: 'Text Preset' },
];

const SaveProjectModal = observer(({ handleClose }) => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState(types[0]);
  const [isLoading, setIsLoading] = useState(false);

  const { save } = usePresetStore();

  const handleChange = string => {
    types.filter(item => (item.value === string ? setType(item) : ''));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await save(type.value, url, name);
      handleClose();
      showSuccess('Saved!');
    } catch (e) {
      setIsLoading(false);
      showError(e.message);
    }
  };

  return (
    <div className="save-as-modal">
      <FormSelect
        items={types}
        value={type}
        onChange={handleChange}
        className="save-as__field"
      />
      <FormTextField
        placeholder="Url"
        className="save-as__field"
        value={url}
        onChange={setUrl}
      />
      <FormTextField
        placeholder="Name"
        className="save-as__field"
        value={name}
        onChange={setName}
      />
      <button
        className="save-as__button"
        disabled={!type.value}
        onClick={handleSave}
      >
        {isLoading ? <LibrarySpinner /> : <span>Save</span>}
      </button>
    </div>
  );
});

export default SaveProjectModal;
