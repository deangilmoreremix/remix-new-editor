import React, { Fragment } from 'react';

import GoogleFontsLoader from '../../../wizard/editor/GoogleFontsLoader';

import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';
import fonts from '../../../../lib/constants/fonts';
import { rgba2hex } from '../../../../lib/lottie/utils';

const Advanced = ({ options, fields, onChange }) => {
  const {
    fontFamily,
    backgroundColor,
    fontDecorations,
  } = options;

  const handleChange = (option) => {
    onChange({ [fields.fontDecorations.name]: { ...option } });
  };

  const handleChangeColor = (rgbColor) => {
    onChange({
      [Object.keys(rgbColor).join()]: rgba2hex(Object.values(rgbColor).join()),
    });
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
            className="font-section__input"
          />
        </div>
        <div className="font-color-section">
          <FieldBuilder
            value={backgroundColor || fields.backgroundColor.default}
            name={fields.backgroundColor.name}
            {...fields.backgroundColor}
            onChange={handleChangeColor}
            className="font-color-section__input"
            disableAlpha
          />
        </div>
        <div className="font-decoration-section">
          <FieldBuilder
            value={fontDecorations?.bold ?? fields.fontDecorations.default.bold}
            name={fields.fontDecorations.bold.name}
            {...fields.fontDecorations.bold}
            onChange={handleChange}
          />
        </div>
      </div>
    </Fragment>
  );
};

Advanced.propTypes = {
  options: PropTypes.shape({
    fontFamily: PropTypes.string,
    fontDecorations: PropTypes.shape({
      bold: PropTypes.boolean,
    }),
    backgroundColor: PropTypes.string,
  }),
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.shape({
    fontFamily: PropTypes.shape({
      name: PropTypes.string,
      default: PropTypes.string,
    }),
    fontDecorations: PropTypes.shape({
      bold: PropTypes.shape({
        name: PropTypes.string,
      }),
      name: PropTypes.string,
      default: PropTypes.shape(),
    }),
    backgroundColor: PropTypes.shape({
      name: PropTypes.string,
      default: PropTypes.string,
    }),
  }),
};

export default Advanced;
