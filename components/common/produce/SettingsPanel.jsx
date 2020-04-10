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
    }).catch(err => showError(err))
      .finally(() => setIsDisabledUpload(false));
  };

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept: mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: false,
  });
  // === Drag and Drop ===

  return (
    <div className="produce-block produce-panel">
      <div className="produce__inputs">
        <FormTextField
          label="Title"
          onChange={update('title')}
          value={item.title}
          className="produce-input"
          labelClassName="produce-panel-text"
          placeholder="My Perfect Videos"
        />
        <FormTextField
          label="Description"
          value={item.description}
          onChange={update('description')}
          className="produce-input"
          labelClassName="produce-panel-text"
          placeholder="A project about ..."
        />
        <FormColor
          onChange={update('background')}
          value={item.background}
          label="Background Color"
        />
      </div>
      <div className="produce__inputs">
        <TagsFormInput
          value={item.tags}
          onChange={update('tags')}
          title="Tags"
          className="produce-input"
          titleClass="produce-panel-text"
        />
        <div className="produce-allow">
          <p className="produce-panel-text">Allow</p>
          <FormCheckboxField
            label="Facebook"
            value={item.allowedSocials && item.allowedSocials.some(s => s === 'facebook')}
            onChange={updateSocials('facebook')}
            floatClassName="produce-checkbox"
          />
          <FormCheckboxField
            label="LinkedIn"
            value={item.allowedSocials && item.allowedSocials.some(s => s === 'linkedin')}
            onChange={updateSocials('linkedin')}
            floatClassName="produce-checkbox"
          />
        </div>

        <div className="produce__row">
          <div className="produce__row-block">
            <div className="produce__row-img">
              <p className="produce__row-text">Thumbnail</p>
              <div className="produce-img-preview"><img src={item.thumbnail} alt="" /></div>
            </div>
          </div>
          <div className="produce__row-block">
            <button className="produce__open-thumbnails" type="button">Use Thumbnails Editor</button>
          </div>
        </div>

        <div className="produce__row">
          <div className="produce__row-block">
            <div className="produce__add-file">
              <input id="produce-file" {...getInputProps()} disabled={isDisabledUpload} multiple={false} />
              <label htmlFor="produce-file" className="produce__add">
                {
                  isDisabledUpload ? <LibrarySpinner /> : <span>Upload</span>
                }
              </label>
            </div>
            <p className="produce__row-text-2">recommended image resolution 1200x630</p>
          </div>
          <div className="produce__row-block">
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
