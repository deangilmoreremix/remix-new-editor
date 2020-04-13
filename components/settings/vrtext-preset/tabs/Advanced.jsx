import React, { Fragment, useState } from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';
import GoogleFontsLoader from '../../../wizard/editor/GoogleFontsLoader';

import PropTypes from '../../../../lib/PropTypes';
import {
  DEFAULT_FIELDS,
  FONT_FAMILY,
  FONT_SIZE,
  FONT_DECORATIONS,
  FONT_COLOR,
  STROKE,
  SHADOW,
  BACKGROUND,
  STROKE_COLOR,
  BACKGROUND_COLOR,
  SHADOW_COLOR,
  FONT_DECORATIONS_ITALIC,
  FONT_DECORATIONS_BOLD, FONT_DECORATIONS_RESPONSIVE,
} from '../../../../lib/constants/settings/vrtext-preset';

import FieldBuilder from '../../../form/FieldBuilder';
import svgArrowBottom from '../../../../public/static/images/text/arrow-bottom.svg';
import fonts from '../../../../lib/constants/fonts';

const Advanced = ({ options, onChange }) => {
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
            value={options[FONT_FAMILY]}
            name={FONT_FAMILY}
            {...DEFAULT_FIELDS[FONT_FAMILY]}
            onChange={onChange}
          />
          <FieldBuilder
            value={options[FONT_SIZE]}
            name={FONT_SIZE}
            {...DEFAULT_FIELDS[FONT_SIZE]}
            onChange={onChange}
          />
        </div>
        <div className="font-decoration-section">
          <FieldBuilder
            value={options[FONT_DECORATIONS][FONT_DECORATIONS_BOLD]}
            name={[FONT_DECORATIONS_BOLD]}
            {...DEFAULT_FIELDS[FONT_DECORATIONS][FONT_DECORATIONS_BOLD]}
            onChange={handleChangeFontDecoration(FONT_DECORATIONS)}
          />
          <FieldBuilder
            value={options[FONT_DECORATIONS][FONT_DECORATIONS_ITALIC]}
            name={[FONT_DECORATIONS_ITALIC]}
            {...DEFAULT_FIELDS[FONT_DECORATIONS][FONT_DECORATIONS_ITALIC]}
            onChange={handleChangeFontDecoration(FONT_DECORATIONS)}
          />
        </div>
        <div className="font-style-section">
          <FieldBuilder
            value={options[FONT_COLOR]}
            name={FONT_COLOR}
            {...DEFAULT_FIELDS[FONT_COLOR]}
            onChange={onChange}
          />
          <div className="container-font-style">
            <FieldBuilder
              value={options[SHADOW]}
              name={SHADOW}
              {...DEFAULT_FIELDS[SHADOW]}
              onChange={onChange}
            />
            <FieldBuilder
              value={options[STROKE]}
              name={STROKE}
              {...DEFAULT_FIELDS[STROKE]}
              onChange={onChange}
            />
            <FieldBuilder
              value={options[BACKGROUND]}
              name={BACKGROUND}
              {...DEFAULT_FIELDS[BACKGROUND]}
              onChange={onChange}
            />
          </div>
        </div>

      </div>
      {/* eslint-disable-next-line max-len */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
      <div className="container-icon-arrow" onClick={() => setAdditionalOptions(!additionalOptions)}>
        <SVGInline
          className={classnames('icon-arrow', { 'icon-arrow-rotate': additionalOptions })}
          classSuffix="-inline"
          svg={svgArrowBottom}
          cleanup={['title']}
        />
      </div>
      {additionalOptions && (
        <div className="container-font-color">
          <FieldBuilder
            value={options[SHADOW_COLOR]}
            key={SHADOW_COLOR}
            name={SHADOW_COLOR}
            {...DEFAULT_FIELDS[SHADOW_COLOR]}
            onChange={onChange}
          />
          <FieldBuilder
            value={options[STROKE_COLOR]}
            key={STROKE_COLOR}
            name={STROKE_COLOR}
            {...DEFAULT_FIELDS[STROKE_COLOR]}
            onChange={onChange}
          />
          <FieldBuilder
            value={options[BACKGROUND_COLOR]}
            key={BACKGROUND_COLOR}
            name={BACKGROUND_COLOR}
            {...DEFAULT_FIELDS[BACKGROUND_COLOR]}
            onChange={onChange}
          />
          <FieldBuilder
            value={options[FONT_DECORATIONS][FONT_DECORATIONS_RESPONSIVE]}
            key={FONT_DECORATIONS_RESPONSIVE}
            name={FONT_DECORATIONS_RESPONSIVE}
            {...DEFAULT_FIELDS[FONT_DECORATIONS][FONT_DECORATIONS_RESPONSIVE]}
            onChange={handleChangeFontDecoration(FONT_DECORATIONS)}
          />
        </div>
      )}
    </Fragment>
  );
};

Advanced.propTypes = {
  options: PropTypes.shape({}),
  onChange: PropTypes.func.isRequired,
};

export default Advanced;
