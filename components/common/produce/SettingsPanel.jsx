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
        effect={update('title')}
        value={item.title}
      />
      <FormTextField
        label="Description"
        value={item.description}
        effect={update('description')}
        componentClass="textarea"
      />
      <FormColor
        effect={update('background')}
        value={item.background}
        label="Background Color"
      />
      <FormList
        label="Tags"
        values={item.tags}
        effect={update('tags')}
      />
      <FormCheckboxField
        label="Facebook"
        value={item.allowedSocials && item.allowedSocials.some(s => s === 'facebook')}
        effect={updateSocials('facebook')}
      />
      <FormCheckboxField
        label="LinkedIn"
        value={item.allowedSocials && item.allowedSocials.some(s => s === 'linkedin')}
        effect={updateSocials('linkedin')}
      />
    </Container>
    // todo implement image uploading
  );
});
