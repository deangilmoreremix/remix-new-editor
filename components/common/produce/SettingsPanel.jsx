import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Container } from 'reactstrap';

import FormList from '../../form/FormList';
import FormColor from '../../form/FormColor';
import FormTextField from '../../form/FormTextField';
import FormCheckboxField from '../../form/FormCheckboxField';

// todo add styles

@inject('projectStore')
@observer
class SettingsPanel extends Component {
  update = (field) => (value) => {
    console.log('settings panel ', this)
    const { projectStore } = this.props;
    projectStore.updateItem({ [field]: value });
  };

  updateSocials = (social) => (value) => {
    const { projectStore } = this.props;
    let { allowedSocials = [] } = projectStore.item;
    if (value && !allowedSocials.some(allowedSocial => allowedSocial === social)) {
      allowedSocials.push(social);
    } else if (!value && allowedSocials.some(allowedSocial => allowedSocial === social)) {
      allowedSocials = allowedSocials.filter(allowedSocial => allowedSocial !== social);
    }
    this.update('allowedSocials')(allowedSocials);
  };

  render() {
    const { projectStore: { item } } = this.props;

    return (
      <Container>
        <FormTextField
          label="Title"
          onChange={this.update('title')}
          value={item.title}
          labelClassName="label-top"
        />
        <FormTextField
          label="Description"
          value={item.description}
          onChange={this.update('description')}
          componentClass="textarea"
          labelClassName="label-top"
        />
        <FormColor
          onChange={this.update('background')}
          value={item.background}
          label="Background Color"
          labelClassName="label-top"
        />
        <FormList
          label="Tags"
          values={item.tags}
          onChange={this.update('tags')}
        />
        <FormCheckboxField
          label="Facebook"
          value={item.allowedSocials && item.allowedSocials.some(s => s === 'facebook')}
          onChange={this.updateSocials('facebook')}
          floatClassName="float-left"
        />
        <FormCheckboxField
          label="LinkedIn"
          value={item.allowedSocials && item.allowedSocials.some(s => s === 'linkedin')}
          onChange={this.updateSocials('linkedin')}
          floatClassName="float-left"
        />
      </Container>
      // todo implement image uploading
    );
  }
}

export default SettingsPanel;
