import React, { Fragment } from 'react';
import SVGInline from 'react-svg-inline';
import GoogleFontsLoader from '../../../wizard/editor/GoogleFontsLoader';

import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';
import fonts from '../../../../lib/constants/fonts';

import svgAlignmentLeft from '../../../../public/static/svgImages/text/advanced/text-align-left.svg';
import svgAlignmentCenter from '../../../../public/static/svgImages/text/advanced/text-align-center.svg';
import svgLetterSpacing from '../../../../public/static/svgImages/text/advanced/letter-spacing.svg';
import svgLineHeight from '../../../../public/static/svgImages/text/advanced/line-height.svg';
import svgAlignmentRight from '../../../../public/static/svgImages/text/advanced/text-align-right.svg';
import svgAlignmentLeftChecked from '../../../../public/static/svgImages/text/advanced/text-align-left-checked.svg';
import svgAlignmentCenterChecked from '../../../../public/static/svgImages/text/advanced/text-align-center-checked.svg';
import svgAlignmentRightChecked from '../../../../public/static/svgImages/text/advanced/text-align-right-checked.svg';


const iconAlignment = [
  { value: 'left', icon: svgAlignmentLeft, checkedIcon: svgAlignmentLeftChecked },
  { value: 'center', icon: svgAlignmentCenter, checkedIcon: svgAlignmentCenterChecked },
  { value: 'right', icon: svgAlignmentRight, checkedIcon: svgAlignmentRightChecked },
];

const Advanced = ({ values, fields, onChange, checkKeyInObj }) => {
  const handleChangeFontDecoration = (field) => (value) => {
    onChange({ [field]: value });
  };

  return (
    <Fragment>
      <div className="container-advanced-settings">
        <div className="font-section">
          <GoogleFontsLoader fonts={fonts} />
          <FieldBuilder
            value={checkKeyInObj(fields.fontFamily.name)}
            name={fields.fontFamily.name}
            {...fields.fontFamily}
            onChange={onChange}
          />
          <FieldBuilder
            value={checkKeyInObj(fields.fontSize.name)}
            name={fields.fontSize.name}
            {...fields.fontSize}
            onChange={onChange}
          />
        </div>
        <div className="font-decoration-section">
          <div className="font-style-container">
            <FieldBuilder
              value={checkKeyInObj(fields.fontDecorations.bold.name, fields.fontDecorations.name)}
              name={fields.fontDecorations.bold.name}
              {...fields.fontDecorations.bold}
              onChange={handleChangeFontDecoration(fields.fontDecorations.name)}
            />
            <FieldBuilder
              value={checkKeyInObj(fields.fontDecorations.italics.name, fields.fontDecorations.name)}
              name={fields.fontDecorations.italics.name}
              {...fields.fontDecorations.italics}
              onChange={handleChangeFontDecoration(fields.fontDecorations.name)}
            />
          </div>
          <div className="icon-edit-text">
            <FieldBuilder
              value={checkKeyInObj(fields.alignment.name)}
              {...fields.alignment}
              onChange={onChange}
              containerClass="container-text-radio"
              items={iconAlignment}
            />
            <div className="container-text-auto">
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
                inputClassName="input-text-percent"
                type="number"
                onChange={onChange}
              />
            </div>
          </div>
        </div>
        <div className="font-style-section">
          <FieldBuilder
            value={checkKeyInObj(fields.fontColor.name)}
            name={fields.fontColor.name}
            {...fields.fontColor}
            onChange={onChange}
          />
          <div className="container-font-style">
            <FieldBuilder
              value={checkKeyInObj(fields.shadow.name)}
              name={fields.shadow.name}
              {...fields.shadow}
              onChange={onChange}
            />
            <FieldBuilder
              value={checkKeyInObj(fields.stroke.name)}
              name={fields.stroke.name}
              {...fields.stroke}
              onChange={onChange}
            />
            <FieldBuilder
              value={checkKeyInObj(fields.background.name)}
              name={fields.background.name}
              {...fields.background}
              onChange={onChange}
            />
          </div>
        </div>

      </div>
      <div className="container-font-color">
        <FieldBuilder
          value={checkKeyInObj(fields.shadowColor.name)}
          disabled={!values.shadow && true}
          name={fields.shadowColor.name}
          {...fields.shadowColor}
          onChange={onChange}
        />
        <FieldBuilder
          value={checkKeyInObj(fields.strokeColor.name)}
          disabled={!values.stroke && true}
          name={fields.strokeColor.name}
          {...fields.strokeColor}
          onChange={onChange}
        />
        <FieldBuilder
          value={checkKeyInObj(fields.backgroundColor.name)}
          disabled={!values.background && true}
          name={fields.backgroundColor.name}
          {...fields.backgroundColor}
          onChange={onChange}
        />
        <FieldBuilder
          value={checkKeyInObj(fields.fontDecorations.responsive.name, fields.fontDecorations.name)}
          name={fields.fontDecorations.responsive.name}
          {...fields.fontDecorations.responsive}
          onChange={handleChangeFontDecoration(fields.fontDecorations.name)}
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
    alignment: PropTypes.arrayOf(PropTypes.string),
    fontColor: PropTypes.string,
    shadow: PropTypes.boolean,
    stroke: PropTypes.boolean,
    background: PropTypes.boolean,
    shadowColor: PropTypes.string,
    strokeColor: PropTypes.string,
    backgroundColor: PropTypes.string,
  }),
  checkKeyInObj: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.shape({
    fontFamily: PropTypes.string,
    fontSize: PropTypes.number,
    fontDecorations: PropTypes.shape({
      name: PropTypes.string,
      bold: PropTypes.object,
      italics: PropTypes.object,
      responsive: PropTypes.object,
    }),
    alignment: PropTypes.arrayOf(PropTypes.string),
    fontColor: PropTypes.string,
    shadow: PropTypes.boolean,
    stroke: PropTypes.boolean,
    background: PropTypes.boolean,
    shadowColor: PropTypes.string,
    strokeColor: PropTypes.string,
    backgroundColor: PropTypes.string,
  }),
};

export default Advanced;
