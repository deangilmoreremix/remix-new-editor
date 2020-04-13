import React, { Fragment, useState } from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';
import GoogleFontsLoader from '../../../wizard/editor/GoogleFontsLoader';

import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';
import svgArrowBottom from '../../../../public/static/svgImages/text/arrow-bottom.svg';
import fonts from '../../../../lib/constants/fonts';

const Advanced = ({ values, fields, onChange }) => {
  const [additionalOptions, setAdditionalOptions] = useState(false);

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
      <div className="container-icon-arrow">
        <SVGInline
          className={classnames('icon-arrow', { 'icon-arrow-rotate': additionalOptions })}
          classSuffix="-inline"
          svg={svgArrowBottom}
          cleanup={['title']}
          onClick={() => setAdditionalOptions(!additionalOptions)}
        />
      </div>
      {additionalOptions && (
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
            {...fields.backgroundColorl}
            onChange={onChange}
          />
          <FieldBuilder
            value={values.fontDecorations.responsive}
            name={fields.fontDecorations.responsive.name}
            {...fields.fontDecorations.responsive}
            onChange={handleChangeFontDecoration(fields.fontDecorations.name)}
          />
        </div>
      )}
    </Fragment>
  );
};

Advanced.propTypes = {
  values: PropTypes.shape({}),
  onChange: PropTypes.func.isRequired,
};

export default Advanced;
