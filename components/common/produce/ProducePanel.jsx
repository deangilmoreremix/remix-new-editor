import React from 'react';
import { observer } from 'mobx-react';
import useProjectStore from '../../hooks/useProjectStore';

import FormList from '../../form/FormList';
import FormColor from '../../form/FormColor';
import FormTextField from '../../form/FormTextField';
import FormCheckboxField from '../../form/FormCheckboxField';

const Test = observer(() => {
  const { item, updateItem } = useProjectStore();
  let { item: { allowedSocials = [] } } = useProjectStore();

  const update = (field) => (value) => {
    updateItem({ [field]: value });
  };

  const updateSocials = (social) => (value) => {
    if (value && !allowedSocials.some(allowedSocial => allowedSocial === social)) {
      allowedSocials.push(social);
    } else if (!value && allowedSocials.some(allowedSocial => allowedSocial === social)) {
      allowedSocials = allowedSocials.filter(allowedSocial => allowedSocial !== social);
    }
    update('allowedSocials')(allowedSocials);
  };

  return (
    <div className="produce-block produce-panel">
      <div className="produce__inputs">
        <FormTextField
          label="Title"
          onChange={update('title')}
          value={item.title}
          className="produce-input"
        />
        <FormTextField
          label="Description"
          value={item.description}
          onChange={update('description')}
          componentClass="textarea"
          className="produce-input"
        />
        <FormColor
          onChange={update('background')}
          value={item.background}
          label="Background Color"
        />
      </div>
      <div className="produce__inputs">
        <FormList
          label="Tags"
          values={item.tags}
          onChange={update('tags')}
        />
        <FormCheckboxField
          label="Facebook"
          value={item.allowedSocials && item.allowedSocials.some(s => s === 'facebook')}
          onChange={updateSocials('facebook')}
          floatClassName="float-left"
        />
        <FormCheckboxField
          label="LinkedIn"
          value={item.allowedSocials && item.allowedSocials.some(s => s === 'linkedin')}
          onChange={updateSocials('linkedin')}
          floatClassName="float-left"
        />
      </div>
    </div>
  );
});

export default Test;
