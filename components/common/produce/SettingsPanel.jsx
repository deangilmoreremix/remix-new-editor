import React, { useState } from 'react';
import { observer } from 'mobx-react';

import Button from '@material-ui/core/Button';
import PropTypes from '../../../lib/PropTypes';
import { ASSET_TYPES } from '../../../lib/constants/media';
import { tabItems } from '../../../lib/constants/library';

import useProjectStore from '../../hooks/useProjectStore';
import useUserStore from '../../hooks/useUserStore';
import useModalStore from '../../hooks/useModalStore';

import FieldBuilder from '../../form/FieldBuilder';
import DropzoneArea from '../../media/DropzoneArea';
import DropButton from '../../media/DropButton';
import { CROP_RECOMMENDED_RESOLUTION } from '../../../lib/constants/settings/image';
import { rgba2hex } from '../../../lib/lottie/utils';

const SettingPanel = observer(() => {
  const [isDisabledUpload, setIsDisabledUpload] = useState(false);

  const titleRef = React.useRef(null);

  const { linkedinEnabled } = useUserStore();
  const { item, updateItem } = useProjectStore();
  let { item: { allowedSocials = [] } } = useProjectStore();
  const { openCropper } = useModalStore();

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
          openCropper(image.url, onImageCropped);
        }
      });
    });
  };

  const onImageCropped = (thumbnail) => {
    updateItem({ thumbnail });
  };
  const handleChangeColor = (rgbColor) => {
    updateItem({ [Object.keys(rgbColor).join()]: rgba2hex(Object.values(rgbColor).join()) });
  };

  return (
    <div className="produce-block settings-panel">
      <div className="settings__inputs">
        <FieldBuilder
          ref={titleRef}
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
          label="Description"
          text
          value={item.description}
          onChange={updateItem}
          className="settings-input"
          textClassName="settings-panel-text"
          placeholder="A project about"
          rows={5}
        />
        <FieldBuilder
          type="color"
          name="background"
          onChange={handleChangeColor}
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
          label="Tags"
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
          {
            linkedinEnabled
          && (
          <FieldBuilder
            type="checkbox"
            name="linkedin"
            label="LinkedIn"
            value={item.allowedSocials && item.allowedSocials.some(s => s === 'linkedin')}
            onChange={updateSocials}
            floatClassName="settings-checkbox"
          />
          )
          }
        </div>

        <div className="settings__row">
          <div className="settings__row-block">
            <div className="settings__row-img">
              <p className="settings__row-text">Thumbnail</p>
              <div className="settings-img-preview"><img src={item.thumbnail} alt="" /></div>
            </div>
          </div>
          <div className="settings__row-block">
            <Button
              onClick={() => openCropper(item.thumbnail, onImageCropped)}
              disableRipple
              disableFocusRipple
              disableTouchRipple
              className="settings__edit-file"
            >
Use Thumbnails Editor
            </Button>
          </div>
        </div>
        <div className="settings__row">
          <div className="settings__row-block">
            <DropButton
              onUploaded={onUploadedImage}
              type={ASSET_TYPES.IMAGE}
              isDisabled={isDisabledUpload}
              startUpload={() => setIsDisabledUpload(true)}
              endUpload={() => setIsDisabledUpload(false)}
              multiple={false}
              className="settings__add-file"
            />
            <p className="settings__row-text-2">
recommended image resolution
              {CROP_RECOMMENDED_RESOLUTION.width}
x
              {CROP_RECOMMENDED_RESOLUTION.height}
            </p>
          </div>
          <div className="settings__row-block">
            <DropzoneArea
              onUploaded={onUploadedImage}
              type={ASSET_TYPES.IMAGE}
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

SettingPanel.propTypes = {
  options: PropTypes.shape({
    focusTitle: PropTypes.bool,
  }),
};

export default SettingPanel;
