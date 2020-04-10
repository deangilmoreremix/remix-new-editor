import React, { Fragment, useState } from 'react';
import { observer } from 'mobx-react';
import { useDropzone } from 'react-dropzone';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import { showError } from '../../../lib/services/alertService';
import mediaConstants from '../../../lib/constants/media';
import { tabItems } from '../../../lib/constants/library';

import useProjectStore from '../../hooks/useProjectStore';
import useMediaStore from '../../hooks/useMediaStore';

import FormColor from '../../form/FormColor';
import FormTextField from '../../form/FormTextField';
import FormCheckboxField from '../../form/FormCheckboxField';
import { LibrarySpinner } from '../../media/Loader';
import TagsFormInput from '../../form/TagsFormInput';

import arrowIcon from '../../../public/static/svgImages/arrow-upper-left.svg';

const Test = observer(() => {
  const [isDisabledUpload, setIsDisabledUpload] = useState(false);

  const { item, updateItem } = useProjectStore();
  let { item: { allowedSocials = [] } } = useProjectStore();
  const { uploadMedia, storeAsset } = useMediaStore();

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

  // === Drag and Drop ===
  const onDrop = (acceptedFiles) => {
    setIsDisabledUpload(true);
    Promise.all(acceptedFiles.map(async data => {
      const asset = await uploadMedia({ data, preview: true });
      const element = await storeAsset(asset.url, asset.preview, 'images');
      const fileExtension = element.url.match(/\.[0-9a-z]{1,5}$/)[0];
      return { element, fileExtension };
    })).then(([{ element, fileExtension }]) => {
      Object.keys(tabItems).forEach(tab => {
        tabItems[tab].formats.forEach(format => {
          if (format === fileExtension) {
            update('thumbnail')(element.url);
          }
        });
      });
    }).catch(() => showError('An error occurred while loading the image.'))
      .finally(() => setIsDisabledUpload(false));
  };

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept: mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: false,
  });
  // === Drag and Drop ===

  return (
    <div className="produce-block settings-panel">
      <div className="settings__inputs">
        <FormTextField
          label="Title"
          onChange={update('title')}
          value={item.title}
          className="settings-input"
          labelClassName="settings-panel-text"
          placeholder="My Perfect Videos"
        />
        <FormTextField
          label="Description"
          value={item.description}
          onChange={update('description')}
          className="settings-input"
          labelClassName="settings-panel-text"
          placeholder="A project about ..."
        />
        <FormColor
          onChange={update('background')}
          value={item.background}
          label="Background Color"
        />
      </div>
      <div className="settings__inputs">
        <TagsFormInput
          value={item.tags}
          onChange={update('tags')}
          title="Tags"
          className="settings-input"
          titleClass="settings-panel-text"
        />
        <div className="settings-allow">
          <p className="settings-panel-text">Allow</p>
          <FormCheckboxField
            label="Facebook"
            value={item.allowedSocials && item.allowedSocials.some(s => s === 'facebook')}
            onChange={updateSocials('facebook')}
            floatClassName="settings-checkbox"
          />
          <FormCheckboxField
            label="LinkedIn"
            value={item.allowedSocials && item.allowedSocials.some(s => s === 'linkedin')}
            onChange={updateSocials('linkedin')}
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
            <div className="settings__add-file">
              <input id="settings-file" {...getInputProps()} disabled={isDisabledUpload} multiple={false} />
              <label htmlFor="settings-file" className="settings__add">
                {
                  isDisabledUpload ? <LibrarySpinner /> : <span>Upload</span>
                }
              </label>
            </div>
            <p className="settings__row-text-2">recommended image resolution 1200x630</p>
          </div>
          <div className="settings__row-block">
            <div
              {...getRootProps()}
              className={classnames(
                'drag-drop',
                {
                  'drag-drop-active': isDragActive,
                  'drag-drop-disabled': isDisabledUpload,
                },
              )}
            >
              <input {...getInputProps()} disabled={isDisabledUpload} multiple={false} />

              {
                item.thumbnail
                  ? <img src={item.thumbnail} alt="" />
                  : (<p className="drag-drop__text">Drag and drop an image here, or click to upload</p>)
              }
              {
                !item.thumbnail && (
                  <Fragment>
                    <SVGInline className="drag-arrow drag-arrow-upper-left" svg={arrowIcon} cleanup={['arrow']} />
                    <SVGInline className="drag-arrow drag-arrow-upper-right" svg={arrowIcon} cleanup={['arrow']} />
                    <SVGInline className="drag-arrow drag-arrow-bottom-left" svg={arrowIcon} cleanup={['arrow']} />
                    <SVGInline className="drag-arrow drag-arrow-bottom-right" svg={arrowIcon} cleanup={['arrow']} />
                  </Fragment>
                )
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default Test;
