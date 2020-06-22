import React, { useState } from 'react';

import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';
import DropzoneArea from '../../../media/DropzoneArea';
import DropButton from '../../../media/DropButton';
import GoogleFontsLoader from '../../../wizard/editor/GoogleFontsLoader';
import { ASSET_TYPES } from '../../../../lib/constants/media';
import { iconAlignmentAdvanced } from '../../../../lib/constants/settings/vrtext-element';
import fonts from '../../../../lib/constants/fonts';
import { tabItems } from '../../../../lib/constants/library';
import useModalStore from '../../../hooks/useModalStore';
import { CROP_RECOMMENDED_RESOLUTION, CROP_BRAND_LOGO_RESOLUTION } from '../../../../lib/constants/settings/image';

const StylesTab = ({ showedForm, values, fields, onChange, onClose }) => {
  const [isDisabledUploadLogo, setIsDisabledUploadLogo] = useState(false);
  const [isDisabledUploadImage, setIsDisabledUploadImage] = useState(false);

  const { openCropper } = useModalStore();

  const onCrop = (image, option) => {
    onChange({ [option]: image.url });
  };

  const onUploadedImage = (image, extension, option, resolution) => {
    Object.keys(tabItems).forEach(tab => {
      tabItems[tab].formats.forEach(format => {
        if (format === extension) {
          openCropper(image.url, onCrop, resolution || CROP_RECOMMENDED_RESOLUTION, option);
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
        label="Advanced Optin Deactivate"
        onChange={() => onClose(!showedForm)}
      />
      <div className="brand-logo-container">
        <div className="upload-container">
          <FieldBuilder
            value={values.brandLogoSrc || ''}
            {...fields.brandLogoSrc}
            onChange={onChange}
          />
          <DropzoneArea
            onUploaded={(item, ext) => onUploadedImage(item, ext,
              fields.brandLogoSrc.name, CROP_BRAND_LOGO_RESOLUTION)}
            type={ASSET_TYPES.IMAGE}
            isDisabled={isDisabledUploadLogo}
            value={values.brandLogoSrc}
            startUpload={() => setIsDisabledUploadLogo(true)}
            endUpload={() => setIsDisabledUploadLogo(false)}
            multiple={false}
          />
          <DropButton
            onUploaded={(item, ext) => onUploadedImage(item, ext,
              fields.brandLogoSrc.name, CROP_BRAND_LOGO_RESOLUTION)}
            type={ASSET_TYPES.IMAGE}
            isDisabled={isDisabledUploadLogo}
            startUpload={() => setIsDisabledUploadLogo(true)}
            endUpload={() => setIsDisabledUploadLogo(false)}
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
            onUploaded={(item, ext) => onUploadedImage(item, ext, fields.backgroundImage.name)}
            type={ASSET_TYPES.IMAGE}
            isDisabled={isDisabledUploadImage}
            value={values.backgroundImage}
            startUpload={() => setIsDisabledUploadImage(true)}
            endUpload={() => setIsDisabledUploadImage(false)}
            multiple={false}
          />
          <DropButton
            onUploaded={(item, ext) => onUploadedImage(item, ext, fields.backgroundImage.name)}
            type={ASSET_TYPES.IMAGE}
            isDisabled={isDisabledUploadImage}
            optionName={fields.backgroundImage.name}
            startUpload={() => setIsDisabledUploadImage(true)}
            endUpload={() => setIsDisabledUploadImage(false)}
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
            className="container-transition-list"
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
