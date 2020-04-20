import React, { Fragment } from 'react';
import SVGInline from 'react-svg-inline';
import GoogleFontsLoader from '../../../wizard/editor/GoogleFontsLoader';

import PropTypes from '../../../../lib/PropTypes';
import FieldBuilder from '../../../form/FieldBuilder';
import fonts from '../../../../lib/constants/fonts';
import { iconAlignmentAdvanced } from '../../../../lib/constants/settings/vrtext-element';

import svgLetterSpacing from '../../../../public/static/svgImages/text/advanced/letter-spacing.svg';
import svgLineHeight from '../../../../public/static/svgImages/text/advanced/line-height.svg';

const Advanced = ({ values, fields, onChange }) => {
  const { bold, italics, responsive } = values.fontDecorations || fields.fontDecorations.default;
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
  } = values;

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
            disabled={responsive}
            minValue={1}
          />
        </div>
        <div className="font-decoration-section">
          <div className="font-decoration-container">
            <FieldBuilder
              value={bold}
              name={fields.fontDecorations.bold.name}
              {...fields.fontDecorations.bold}
              onChange={(v) => onChange({ [fields.fontDecorations.name]: v })}
            />
            <FieldBuilder
              value={italics}
              name={fields.fontDecorations.italics.name}
              {...fields.fontDecorations.italics}
              onChange={(v) => onChange({ [fields.fontDecorations.name]: v })}
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
            <div className="text-auto-container">
              <SVGInline
                className="elements-panel-icon"
                classSuffix="-settings-group"
                svg={svgLetterSpacing}
                cleanup={['title']}
              />
              <button className="btn-text-auto">Auto</button>
              <SVGInline
                className="elements-panel-icon"
                classSuffix="-settings-group"
                svg={svgLineHeight}
                cleanup={['title']}
              />
              <FieldBuilder
                name={fields.fontSize.name}
                inputClassName="input-text-percent"
                type="number"
                onChange={onChange}
              />
            </div>
          </div>
        </div>
        <div className="font-style-section">
          <FieldBuilder
            value={fontColor || fields.fontColor.default}
            name={fields.fontColor.name}
            {...fields.fontColor}
            onChange={onChange}
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
              value={background || fields.background.stroke}
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
        />
        <FieldBuilder
          value={strokeColor || fields.strokeColor.default}
          disabled={!values.stroke}
          name={fields.strokeColor.name}
          {...fields.strokeColor}
          onChange={onChange}
        />
        <FieldBuilder
          value={backgroundColor || fields.backgroundColor.default}
          disabled={!values.background}
          name={fields.backgroundColor.name}
          {...fields.backgroundColor}
          onChange={onChange}
        />
        <FieldBuilder
          value={responsive}
          name={fields.fontDecorations.responsive.name}
          {...fields.fontDecorations.responsive}
          onChange={(v) => onChange({ [fields.fontDecorations.name]: v })}
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
    fontFamily: PropTypes.object,
    fontSize: PropTypes.object,
    fontDecorations: PropTypes.shape({
      bold: PropTypes.object,
      italics: PropTypes.object,
      responsive: PropTypes.object,
      name: PropTypes.string,
      default: PropTypes.object,
    }),
    alignment: PropTypes.object,
    fontColor: PropTypes.object,
    shadow: PropTypes.object,
    stroke: PropTypes.object,
    background: PropTypes.object,
    shadowColor: PropTypes.object,
    strokeColor: PropTypes.object,
    backgroundColor: PropTypes.object,
  }),
};

export default Advanced;
