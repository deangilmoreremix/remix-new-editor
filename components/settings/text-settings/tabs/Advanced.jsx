import React, { Fragment } from 'react';
import classnames from 'classnames';

import GoogleFontsLoader from '../../../wizard/editor/GoogleFontsLoader';

import PropTypes from '../../../../lib/PropTypes';

import { showInfo } from '../../../../lib/services/alertService';
import FieldBuilder from '../../../form/FieldBuilder';
import fonts from '../../../../lib/constants/fonts';
import {
  iconAlignmentAdvanced,
  WARNING,
  CONTENT_RESPONSIVE,
} from '../../../../lib/constants/settings/vrtext-element';

const Advanced = ({ values, fields, onChange }) => {
  const {
    fontFamily,
    fontSize,
    alignment,
    fontColor,
    shadow,
    stroke,
    background,
    shadowColor,
    strokeColor,
    backgroundColor,
    fontDecorations,
  } = values;

  const handleChange = (option, fieldName) => {
    if (fieldName && !option.responsive) {
      showInfo(CONTENT_RESPONSIVE, WARNING);
    }
    onChange({ [fields.fontDecorations.name]: { ...fontDecorations, ...option } });
  };

  return (
    <Fragment>
      <div className="advanced-settings-container">
        <div className="font-section">
          <GoogleFontsLoader fonts={fonts} />
          <FieldBuilder
            value={fontFamily || fields.fontFamily.default}
            name={fields.fontFamily.name}
            {...fields.fontFamily}
            onChange={onChange}
          />
          <FieldBuilder
            value={fontSize || fields.fontSize.default}
            name={fields.fontSize.name}
            {...fields.fontSize}
            onChange={onChange}
            disabled={fontDecorations.responsive}
            minValue={1}
            containerClassName={classnames('slider-container', { 'slider-element': !fontDecorations.responsive })}
          />
        </div>
        <div className="font-decoration-section">
          <div className="font-decoration-container">
            <FieldBuilder
              value={fontDecorations.bold}
              name={fields.fontDecorations.bold.name}
              {...fields.fontDecorations.bold}
              onChange={(v) => handleChange(v)}
            />
            <FieldBuilder
              value={fontDecorations.italics}
              name={fields.fontDecorations.italics.name}
              {...fields.fontDecorations.italics}
              onChange={(v) => handleChange(v)}
            />
          </div>
          <div className="icon-edit-text">
            <FieldBuilder
              value={alignment || fields.alignment.default}
              name={fields.alignment.name}
              {...fields.alignment}
              onChange={onChange}
              containerClass="text-radio-container"
              items={iconAlignmentAdvanced}
            />
          </div>
        </div>
        <div className="font-style-section">
          <FieldBuilder
            value={fontColor || fields.fontColor.default}
            name={fields.fontColor.name}
            {...fields.fontColor}
            onChange={onChange}
            className="font-color-container-input"
          />
          <div className="font-style-container">
            <FieldBuilder
              value={shadow || fields.shadow.default}
              name={fields.shadow.name}
              {...fields.shadow}
              onChange={onChange}
            />
            <FieldBuilder
              value={stroke || fields.stroke.default}
              name={fields.stroke.name}
              {...fields.stroke}
              onChange={onChange}
            />
            <FieldBuilder
              value={background || fields.background.default}
              name={fields.background.name}
              {...fields.background}
              onChange={onChange}
            />
          </div>
        </div>

      </div>
      <div className="font-color-container">
        <FieldBuilder
          value={shadowColor || fields.shadowColor.default}
          disabled={!values.shadow}
          name={fields.shadowColor.name}
          {...fields.shadowColor}
          onChange={onChange}
          className="font-color-container-input"
        />
        <FieldBuilder
          value={strokeColor || fields.strokeColor.default}
          disabled={!values.stroke}
          name={fields.strokeColor.name}
          {...fields.strokeColor}
          onChange={onChange}
          className="font-color-container-input"
        />
        <FieldBuilder
          value={backgroundColor || fields.backgroundColor.default}
          disabled={!values.background}
          name={fields.backgroundColor.name}
          {...fields.backgroundColor}
          onChange={onChange}
          className="font-color-container-input"
        />
        <FieldBuilder
          value={fontDecorations.responsive}
          name={fields.fontDecorations.responsive.name}
          {...fields.fontDecorations.responsive}
          onChange={(v) => handleChange(v, fields.fontDecorations.responsive.name)}
        />
      </div>
    </Fragment>
  );
};

Advanced.propTypes = {
  values: PropTypes.shape({
    fontFamily: PropTypes.string,
    fontSize: PropTypes.number,
    fontDecorations: PropTypes.shape({
      bold: PropTypes.boolean,
      italics: PropTypes.boolean,
      responsive: PropTypes.boolean,
    }),
    alignment: PropTypes.string,
    fontColor: PropTypes.string,
    shadow: PropTypes.boolean,
    stroke: PropTypes.boolean,
    background: PropTypes.boolean,
    shadowColor: PropTypes.string,
    strokeColor: PropTypes.string,
    backgroundColor: PropTypes.string,
  }),
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.shape({
    fontFamily: PropTypes.shape({
      name: PropTypes.string,
      default: PropTypes.string,
    }),
    fontSize: PropTypes.shape({
      name: PropTypes.string,
      default: PropTypes.number,
    }),
    fontDecorations: PropTypes.shape({
      bold: PropTypes.shape({
        name: PropTypes.string,
      }),
      italics: PropTypes.shape({
        name: PropTypes.string,
      }),
      responsive: PropTypes.shape({
        name: PropTypes.string,
      }),
      name: PropTypes.string,
      default: PropTypes.shape(),
    }),
    alignment: PropTypes.shape({
      name: PropTypes.string,
      default: PropTypes.string,
    }),
    fontColor: PropTypes.shape({
      name: PropTypes.string,
      default: PropTypes.string,
    }),
    shadow: PropTypes.shape({
      name: PropTypes.string,
      default: PropTypes.bool,
    }),
    stroke: PropTypes.shape({
      name: PropTypes.string,
      default: PropTypes.bool,
    }),
    background: PropTypes.shape({
      name: PropTypes.string,
      default: PropTypes.bool,
    }),
    shadowColor: PropTypes.shape({
      name: PropTypes.string,
      default: PropTypes.string,
    }),
    strokeColor: PropTypes.shape({
      name: PropTypes.string,
      default: PropTypes.string,
    }),
    backgroundColor: PropTypes.shape({
      name: PropTypes.string,
      default: PropTypes.string,
    }),
  }),
};

export default Advanced;
