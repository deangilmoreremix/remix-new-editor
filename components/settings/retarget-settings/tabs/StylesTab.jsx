import React, { useState } from 'react';

import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';
import DropzoneArea from '../../../media/DropzoneArea';
import DropButton from '../../../media/DropButton';
import GoogleFontsLoader from '../../../wizard/editor/GoogleFontsLoader';
import useProjectStore from '../../../hooks/useProjectStore';
import mediaConstants from '../../../../lib/constants/media';
import { iconAlignmentAdvanced } from '../../../../lib/constants/settings/vrtext-element';
import fonts from '../../../../lib/constants/fonts';
import { tabItems } from '../../../../lib/constants/library';

const StylesTab = ({ showedForm, values, fields, onChange, onClose }) => {
  const { updateItem } = useProjectStore();
  const [isDisabledUpload, setIsDisabledUpload] = useState(false);

  const onUploadedImage = (image, extension, option) => {
    Object.keys(tabItems).forEach(tab => {
      tabItems[tab].formats.forEach(format => {
        if (format === extension) {
          updateItem({ thumbnail: image.url });
          onChange({ [option]: image.url });
        }
      });
    });
  };

  return (
    <div className="retarget-styles-tab">
      <FieldBuilder
        value={showedForm}
        type="checkbox"
        name="showedUI"
        label="List Builder Deactivate"
        onChange={onClose}
      />
      <div className="brand-logo-container">
        <div className="upload-container">
          <FieldBuilder
            value={values.brandLogoSrc || ''}
            {...fields.brandLogoSrc}
            onChange={onChange}
          />
          <DropzoneArea
            onUploaded={onUploadedImage}
            type={mediaConstants.ASSET_TYPES.IMAGE}
            optionName={fields.brandLogoSrc.name}
            isDisabled={isDisabledUpload}
            value={values.brandLogoSrc}
            startUpload={() => setIsDisabledUpload(true)}
            endUpload={() => setIsDisabledUpload(false)}
            multiple={false}
          />
          <DropButton
            onUploaded={onUploadedImage}
            type={mediaConstants.ASSET_TYPES.IMAGE}
            optionName={fields.brandLogoSrc.name}
            isDisabled={isDisabledUpload}
            startUpload={() => setIsDisabledUpload(true)}
            endUpload={() => setIsDisabledUpload(false)}
            multiple={false}
          />
        </div>
        <div className="upload-container">
          <FieldBuilder
            value={values.backgroundImage || ''}
            {...fields.backgroundImage}
            onChange={onChange}
          />
          <DropzoneArea
            onUploaded={onUploadedImage}
            type={mediaConstants.ASSET_TYPES.IMAGE}
            optionName={fields.backgroundImage.name}
            startUpload={() => setIsDisabledUpload(true)}
            endUpload={() => setIsDisabledUpload(false)}
            multiple={false}
          />
          <DropButton
            onUploaded={onUploadedImage}
            type={mediaConstants.ASSET_TYPES.IMAGE}
            optionName={fields.backgroundImage.name}
            isDisabled={isDisabledUpload}
            startUpload={() => setIsDisabledUpload(true)}
            endUpload={() => setIsDisabledUpload(false)}
            multiple={false}
          />
        </div>
      </div>
      <div>
        <div>
          <FieldBuilder
            value={values.enableSkipButton || fields.enableSkipButton.default}
            {...fields.enableSkipButton}
            onChange={onChange}
          />
          <div className="select-container">
            <div className="select-container-numbers">
              <FieldBuilder
                value={typeof (values.width) !== 'undefined' ? values.width : fields.width.default}
                {...fields.width}
                onChange={onChange}
                className="width-container"
              />
              <FieldBuilder
                value={values.height || fields.height.default}
                {...fields.height}
                onChange={onChange}
                className="height-container"
              />
            </div>
            <GoogleFontsLoader fonts={fonts} />
            <FieldBuilder
              value={values.fontFamily || fields.fontFamily.default}
              {...fields.fontFamily}
              onChange={onChange}
            />
          </div>
          <div className="caption-container">
            <div className="caption-container-radio">
              <FieldBuilder
                value={values.captionAlignment || fields.captionAlignment.default}
                {...fields.captionAlignment}
                onChange={onChange}
                radioClassName="radio-container"
                containerClassName="text-radio-container"
                items={iconAlignmentAdvanced}
              />
            </div>
            <FieldBuilder
              value={values.captionFontSize || fields.captionFontSize.default}
              {...fields.captionFontSize}
              onChange={onChange}
              minValue={1}
              containerClassName="caption-container-slider slider-element"
            />
          </div>
        </div>
        <div className="color-container">
          <div className="color-container-font">
            <FieldBuilder
              value={values.fontColor || fields.fontColor.default}
              {...fields.fontColor}
              onChange={onChange}
            />
            <FieldBuilder
              value={values.fontSize || fields.fontSize.default}
              {...fields.fontSize}
              onChange={onChange}
              containerClassName="slider-element"
            />
          </div>
          <div className="color-container-inner">
            <FieldBuilder
              value={values.innerColor || fields.innerColor.default}
              {...fields.innerColor}
              onChange={onChange}
              className="inner-color"
            />
            <div className="number-container">
              <FieldBuilder
                value={values.innerWidth || fields.innerWidth.default}
                {...fields.innerWidth}
                onChange={onChange}
              />
              <FieldBuilder
                value={values.innerHeight || fields.innerHeight.default}
                {...fields.innerHeight}
                onChange={onChange}
              />
            </div>
          </div>
          <FieldBuilder
            value={values.innerOpacity || fields.innerOpacity.default}
            {...fields.innerOpacity}
            onChange={onChange}
            containerClassName="inner-slider-container slider-element"
            sliderClassName="inner-slider"
          />
        </div>
        <div className="background-color-container">
          <FieldBuilder
            value={values.backgroundColor || fields.backgroundColor.default}
            {...fields.backgroundColor}
            onChange={onChange}
          />
          <FieldBuilder
            value={values.buttonBackground || fields.buttonBackground.default}
            {...fields.buttonBackground}
            onChange={onChange}
          />
          <FieldBuilder
            value={values.buttonFontColor || fields.buttonFontColor.default}
            {...fields.buttonFontColor}
            onChange={onChange}
          />
          <FieldBuilder
            value={values.buttonBorderRadius || fields.buttonBorderRadius.default}
            {...fields.buttonBorderRadius}
            onChange={onChange}
          />
          <FieldBuilder
            value={values.btnBottomBorder || fields.btnBottomBorder.default}
            {...fields.btnBottomBorder}
            onChange={onChange}
          />
          <FieldBuilder
            value={values.transition || fields.transition.default}
            {...fields.transition}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  );
};

StylesTab.propTypes = {
  showedForm: PropTypes.bool,
  values: PropTypes.shape({
    brandLogoSrc: PropTypes.string,
    backgroundImage: PropTypes.string,
    enableSkipButton: PropTypes.bool,
    width: PropTypes.number,
    height: PropTypes.number,
    fontFamily: PropTypes.string,
    captionAlignment: PropTypes.string,
    captionFontSize: PropTypes.number,
    fontColor: PropTypes.string,
    innerColor: PropTypes.string,
    fontSize: PropTypes.number,
    innerWidth: PropTypes.number,
    innerHeight: PropTypes.number,
    innerOpacity: PropTypes.number,
    backgroundColor: PropTypes.string,
    buttonBackground: PropTypes.string,
    buttonFontColor: PropTypes.string,
    buttonBorderRadius: PropTypes.string,
    btnBottomBorder: PropTypes.string,
    transition: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.shape({
    brandLogoSrc: PropTypes.shape({
      name: PropTypes.string,
    }),
    backgroundImage: PropTypes.shape({
      name: PropTypes.string,
    }),
    enableSkipButton: PropTypes.shape({
      default: PropTypes.bool,
    }),
    width: PropTypes.shape({
      default: PropTypes.number,
    }),
    height: PropTypes.shape({
      default: PropTypes.number,
    }),
    fontFamily: PropTypes.shape({
      default: PropTypes.string,
    }),
    captionAlignment: PropTypes.shape({
      default: PropTypes.string,
    }),
    captionFontSize: PropTypes.shape({
      default: PropTypes.number,
    }),
    fontColor: PropTypes.shape({
      default: PropTypes.string,
    }),
    innerColor: PropTypes.shape({
      default: PropTypes.string,
    }),
    fontSize: PropTypes.shape({
      default: PropTypes.number,
    }),
    innerWidth: PropTypes.shape({
      default: PropTypes.number,
    }),
    innerHeight: PropTypes.shape({
      default: PropTypes.number,
    }),
    innerOpacity: PropTypes.shape({
      default: PropTypes.number,
    }),
    backgroundColor: PropTypes.shape({
      default: PropTypes.string,
    }),
    buttonBackground: PropTypes.shape({
      default: PropTypes.string,
    }),
    buttonFontColor: PropTypes.shape({
      default: PropTypes.string,
    }),
    buttonBorderRadius: PropTypes.shape({
      default: PropTypes.string,
    }),
    btnBottomBorder: PropTypes.shape({
      default: PropTypes.string,
    }),
    transition: PropTypes.shape({
      default: PropTypes.string,
    }),
  }),
};

export default StylesTab;
