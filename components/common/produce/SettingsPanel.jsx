import React, { useState, useMemo } from 'react';
import { observer } from 'mobx-react';

import Button from '@material-ui/core/Button';
import PropTypes from '../../../lib/PropTypes';

import useProjectStore from '../../hooks/useProjectStore';
import useUserStore from '../../hooks/useUserStore';
import useModalStore from '../../hooks/useModalStore';

import FieldBuilder from '../../form/FieldBuilder';
import { CROP_RECOMMENDED_RESOLUTION } from '../../../lib/constants/settings/image';
import { IMAGE_CROPPER_MODAL } from '../../../lib/constants/modals';
import { rgba2hex } from '../../../lib/lottie/utils';
import { produceTooltips } from '../../../lib/constants/tooltips';
import DropAndEditButton from '../../media/DropAndEditButton';
import HelpIconComponent from '../HelpIcon';

const SettingPanel = observer(() => {
  const [isDisabledUpload, setIsDisabledUpload] = useState(false);

  const titleRef = React.useRef(null);

  const { linkedinEnabled, isSuperAdmin } = useUserStore();
  const {
    item,
    updateItem,
    updateCategories,
    clearAllCategories,
    removeCategory,
  } = useProjectStore();
  let { item: { allowedSocials = [] } } = useProjectStore();
  const { openImageEditor, closeModal } = useModalStore();

  const categories = useMemo(() => item.categories, [item.categories]);

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

  const onUploadedImage = (image) => {
    updateItem({ thumbnail: image.url });
  };

  const onImageEdited = (thumbnail) => {
    updateItem({ thumbnail });
  };

  const openEditor = (image) => {
    closeModal(IMAGE_CROPPER_MODAL);
    openImageEditor({
      src: image || item.thumbnail,
      onImageEdited,
      startUpload: () => setIsDisabledUpload(true),
      endUpload: () => setIsDisabledUpload(false),
      noCrop: true,
    });
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
        <FieldBuilder
          type="checkbox"
          name="disabledPlaybar"
          label="Show playbar"
          value={!item.disabledPlaybar}
          onChange={() => updateItem({ disabledPlaybar: !item.disabledPlaybar })}
          floatClassName="settings-checkbox settings-checkbox-playbar"
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
          tooltipMessage={produceTooltips.tags}
          isTooltip
        />
        {isSuperAdmin && (
          <FieldBuilder
            type="multipleSelect"
            name="categories"
            label="Categories"
            items={categories}
            path="/api/make-categories"
            clear={clearAllCategories}
            addInput={updateCategories}
            removeInput={removeCategory}
          />
        )}
        <div className="settings-allow">
          <div className="settings-allow__label-box">
            <p className="settings-panel-text">Allow</p>
            <HelpIconComponent
              isText
              padding="0 1.56rem 0 0"
              height={25}
              message={produceTooltips.allow}
            />
          </div>
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
            {
              item.thumbnail
            && (
            <Button
              onClick={() => openEditor()}
              disableRipple
              disableFocusRipple
              disableTouchRipple
              className="settings__edit-file"
            >
              Image Editor
            </Button>
            )
            }
          </div>
        </div>
        <div className="settings__row">
          <div className="settings__row-block">
            <div className="settings__first-row-block">
              <DropAndEditButton
                onUploaded={onUploadedImage}
                isDisabled={isDisabledUpload}
                startUpload={() => setIsDisabledUpload(true)}
                endUpload={() => setIsDisabledUpload(false)}
                needSaveAsset={false}
                tooltipMessage={produceTooltips.thumbnailUpload}
                openImageEditor={(image) => openEditor(image)}
              />
            </div>
            <p className="settings__row-text-2">
              recommended image resolution
              {CROP_RECOMMENDED_RESOLUTION.width}
              x
              {CROP_RECOMMENDED_RESOLUTION.height}
            </p>
          </div>
          <div className="settings__row-block">
            <DropAndEditButton
              isArea
              onUploaded={onUploadedImage}
              isDisabled={isDisabledUpload}
              value={item.thumbnail}
              startUpload={() => setIsDisabledUpload(true)}
              endUpload={() => setIsDisabledUpload(false)}
              needSaveAsset={false}
              openImageEditor={(image) => openEditor(image)}
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
