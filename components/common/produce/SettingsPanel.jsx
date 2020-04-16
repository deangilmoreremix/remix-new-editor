import React, { useState } from 'react';
import { observer } from 'mobx-react';

import mediaConstants from '../../../lib/constants/media';
import { tabItems } from '../../../lib/constants/library';

import useProjectStore from '../../hooks/useProjectStore';

import FieldBuilder from '../../form/FieldBuilder';
import DropzoneArea from '../../media/DropzoneArea';
import DropButton from '../../media/DropButton';

const SettingPanel = observer(() => {
  const [isDisabledUpload, setIsDisabledUpload] = useState(false);

  const { item, updateItem } = useProjectStore();
  let { item: { allowedSocials = [] } } = useProjectStore();

  const updateSocials = (data) => {
    const socialValue = data[Object.keys(data)[0]];
    const socialKey = Object.keys(data)[0];

    if (socialValue
      && !allowedSocials.includes(socialKey)) {
      allowedSocials.push(socialKey);
    } else if (!socialValue
      && allowedSocials.includes(socialKey)) {
      allowedSocials = allowedSocials.filter(
        allowedSocial => allowedSocial !== socialKey,
      );
    }
    updateItem({ allowedSocials });
  };

  const onUploadedImage = (image, extension) => {
    Object.keys(tabItems).forEach(tab => {
      tabItems[tab].formats.forEach(format => {
        if (format === extension) {
          updateItem({ thumbnail: image.url });
        }
      });
    });
  };

  return (
    <div className="produce-block settings-panel">
      <div className="settings__inputs">
        <FieldBuilder
          type="input"
          name="title"
          label="Title"
          onChange={updateItem}
          value={item.title}
          className="settings-input"
          labelClassName="settings-panel-text"
          placeholder="My Perfect Videos"
        />
        <FieldBuilder
          type="textarea"
          name="description"
          text="Description"
          value={item.description}
          onChange={updateItem}
          className="settings-input"
          textClassName="settings-panel-text"
          placeholder="A project about"
          rows="5"
        />
        <FieldBuilder
          type="color"
          name="background"
          onChange={updateItem}
          value={item.background}
          label="Background Color"
          className="settings-formcolor"
        />
      </div>
      <div className="settings__inputs">
        <FieldBuilder
          type="tags"
          name="tags"
          value={item.tags}
          onChange={updateItem}
          title="Tags"
          className="settings-input"
          titleClass="settings-panel-text"
        />
        <div className="settings-allow">
          <p className="settings-panel-text">Allow</p>
          <FieldBuilder
            type="checkbox"
            name="facebook"
            label="Facebook"
            value={item.allowedSocials && item.allowedSocials.some(s => s === 'facebook')}
            onChange={updateSocials}
            floatClassName="settings-checkbox"
          />
          <FieldBuilder
            type="checkbox"
            name="linkedin"
            label="LinkedIn"
            value={item.allowedSocials && item.allowedSocials.some(s => s === 'linkedin')}
            onChange={updateSocials}
            floatClassName="settings-checkbox"
          />
        </div>

        <div className="settings__row">
          <div className="settings__row-block">
            <div className="settings__row-img">
              <p className="settings__row-text">Thumbnail</p>
              <div className="settings-img-preview"><img src={item.thumbnail} alt="" /></div>
            </div>
          </div>
          <div className="settings__row-block">
            <button className="settings__open-thumbnails" type="button">Use Thumbnails Editor</button>
          </div>
        </div>
        <div className="settings__row">
          <div className="settings__row-block">
            <DropButton
              onUploaded={onUploadedImage}
              type={mediaConstants.ASSET_TYPES.IMAGE}
              isDisabled={isDisabledUpload}
              startUpload={() => setIsDisabledUpload(true)}
              endUpload={() => setIsDisabledUpload(false)}
              multiple={false}
              className="settings__add-file"
            />
            <p className="settings__row-text-2">recommended image resolution 1200x630</p>
          </div>
          <div className="settings__row-block">
            <DropzoneArea
              onUploaded={onUploadedImage}
              type={mediaConstants.ASSET_TYPES.IMAGE}
              isDisabled={isDisabledUpload}
              value={item.thumbnail}
              startUpload={() => setIsDisabledUpload(true)}
              endUpload={() => setIsDisabledUpload(false)}
              multiple={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default SettingPanel;
