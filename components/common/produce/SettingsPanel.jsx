import React, { useState, useContext } from 'react';
import { inject, observer } from 'mobx-react';
import { ChromePicker } from 'react-color';

import { Col, Container, Row } from 'reactstrap';
import FormTextField from '../../form/FormTextField';
import FormList from '../../form/FormList';
import FormCheckboxField from '../../form/FormCheckboxField';
import useProjectStore from '../../hooks/useProjectStore';
import PropTypes from '../../../lib/PropTypes';
// todo add styles

const SettingsPanel = observer(() => {
  const { item, updateItem } = useProjectStore();

  const update = (field) => (value) => {
    updateItem({ [field]: value });
  };

  return (
    <Container>
      <FormTextField
        label="Title"
        effect={update('title')}
        value={item.title}
      />
      <FormTextField
        label="Description"
        value={item.description}
        effect={update('description')}
        componentClass="textarea"
      />
      <ChromePicker />
      <FormList
        label="Tags"
        values={item.tags}
      />
      <FormCheckboxField
        label="Facebook"
        value={item.allowedSocials && item.allowedSocials.some(s => s === 'facebook')}
      />
      <FormCheckboxField
        label="LinkedIn"
        value={item.allowedSocials && item.allowedSocials.some(s => s === 'linkedin')}
      />
    </Container>
    // todo implement image uploading
  );
});

SettingsPanel.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string,
    label: PropTypes.string,
    icon: PropTypes.string,
    items: PropTypes.arrayOf(PropTypes.shape({
      action: PropTypes.func,
      label: PropTypes.string,
      icon: PropTypes.string,
    })),
    renderer: PropTypes.func.isRequired,
  })).isRequired,
};

export default SettingsPanel;
