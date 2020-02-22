import React from 'react';
import { observer } from 'mobx-react';
import { Container } from 'reactstrap';

import FormList from '../../form/FormList';
import FormColor from '../../form/FormColor';
import FormTextField from '../../form/FormTextField';
import FormCheckboxField from '../../form/FormCheckboxField';

import useProjectStore from '../../hooks/useProjectStore';

// todo add styles

export default observer(() => {
  const { item, updateItem } = useProjectStore();

  const update = (field) => (value) => {
    updateItem({ [field]: value });
  };
  const updateSocials = (social) => (value) => {
    let { allowedSocials = [] } = item;
    if (value && !allowedSocials.some(allowedSocial => allowedSocial === social)) {
      allowedSocials.push(social);
    } else if (!value && allowedSocials.some(allowedSocial => allowedSocial === social)) {
      allowedSocials = allowedSocials.filter(allowedSocial => allowedSocial !== social);
    }
    update('allowedSocials')(allowedSocials);
  };

  return (
    <Container>
      <FormTextField
        label="Title"
        onChange={update('title')}
        value={item.title}
      />
      <FormTextField
        label="Description"
        value={item.description}
        onChange={update('description')}
        componentClass="textarea"
      />
      <FormColor
        onChange={update('background')}
        value={item.background}
        label="Background Color"
      />
      <FormList
        label="Tags"
        values={item.tags}
        onChange={update('tags')}
      />
      <FormCheckboxField
        label="Facebook"
        value={item.allowedSocials && item.allowedSocials.some(s => s === 'facebook')}
        onChange={updateSocials('facebook')}
      />
      <FormCheckboxField
        label="LinkedIn"
        value={item.allowedSocials && item.allowedSocials.some(s => s === 'linkedin')}
        onChange={updateSocials('linkedin')}
      />
    </Container>
    // todo implement image uploading
  );
});
