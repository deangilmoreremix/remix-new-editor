import React, { Fragment } from 'react';
import GoogleFontsLoader from '../../../wizard/editor/GoogleFontsLoader';

import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';
import fonts from '../../../../lib/constants/fonts';
import FormRadioButton from '../../../form/FormRadioButton';
import svgTextAlignmentLeft from '../../../../public/static/svgImages/text/text-align-left.svg';
import svgTextAlignmentCenter from '../../../../public/static/svgImages/text/text-align-center.svg';
import svgTextAlignmentRight from '../../../../public/static/svgImages/text/text-align-right.svg';

const itemIcons = [{ icon: svgTextAlignmentLeft }, { icon: svgTextAlignmentCenter }, { icon: svgTextAlignmentRight }];

const Advanced = ({ values, fields, onChange }) => {
  const handleChangeFontDecoration = (field) => (value) => {
    onChange({ [field]: value });
  };

  return (
    <Fragment>
      <div className="container-advanced-settings">
        <div className="font-section">
          <GoogleFontsLoader fonts={fonts} />
          <FieldBuilder
            value={values.fontFamily}
            name={fields.fontFamily.name}
            {...fields.fontFamily}
            onChange={onChange}
          />
          <FieldBuilder
            value={values.fontSize}
            name={fields.fontSize.name}
            {...fields.fontSize}
            onChange={onChange}
          />
        </div>
        <div className="font-decoration-section">
          <div className="font-style-container">
            <FieldBuilder
              value={values.fontDecorations.bold}
              name={fields.fontDecorations.bold.name}
              {...fields.fontDecorations.bold}
              onChange={handleChangeFontDecoration(fields.fontDecorations.name)}
            />
            <FieldBuilder
              value={values.fontDecorations.italics}
              name={fields.fontDecorations.italics.name}
              {...fields.fontDecorations.italics}
              onChange={handleChangeFontDecoration(fields.fontDecorations.name)}
            />
          </div>
          <FormRadioButton
            value={values.alignment}
            type="radio"
            name="radio"
            items={itemIcons}
            onChange={onChange}
          />
        </div>
        <div className="font-style-section">
          <FieldBuilder
            value={values.fontColor}
            name={fields.fontColor.name}
            {...fields.fontColor}
            onChange={onChange}
          />
          <div className="container-font-style">
            <FieldBuilder
              value={values.shadow}
              name={fields.shadow.name}
              {...fields.shadow}
              onChange={onChange}
            />
            <FieldBuilder
              value={values.stroke}
              name={fields.stroke.name}
              {...fields.stroke}
              onChange={onChange}
            />
            <FieldBuilder
              value={values.background}
              name={fields.background.name}
              {...fields.background}
              onChange={onChange}
            />
          </div>
        </div>

      </div>
        <div className="container-font-color">
          <FieldBuilder
            value={values.shadowColor}
            name={fields.shadowColor.name}
            {...fields.shadowColor}
            onChange={onChange}
          />
          <FieldBuilder
            value={values.strokeColor}
            name={fields.strokeColor.name}
            {...fields.strokeColor}
            onChange={onChange}
          />
          <FieldBuilder
            value={values.backgroundColor}
            name={fields.backgroundColor.name}
            {...fields.backgroundColor}
            onChange={onChange}
          />
          <FieldBuilder
            value={values.fontDecorations.responsive}
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
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.shape({
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
  })
};

export default Advanced;
