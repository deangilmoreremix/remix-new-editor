import React, { Fragment, useState } from 'react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../../lib/PropTypes';
import FieldBuilder from '../../../form/FieldBuilder';
import { iconAlignment, iconPosition } from '../../../../lib/constants/settings/vrtext-element';

import svgTextLetterSpacing from '../../../../public/static/svgImages/text/basic_group/letter-spacing.svg';

const Basic = ({ fields, onChange, checkKeyInObj }) => {
  const [valueSelect, setValueSelect] = useState(fields.linkTarget.items[0]);

  return (
    <Fragment>
      <div className="container-text">
        <div className="container-text-time">
          <FieldBuilder
            value={checkKeyInObj(fields.start.name)}
            {...fields.start}
            className="input-time-position"
            onChange={onChange}
          />
          <FieldBuilder
            value={checkKeyInObj(fields.end.name)}
            {...fields.end}
            className="input-time-position"
            onChange={onChange}
          />
        </div>
        <span>Text Position</span>
      </div>
      {/* todo icons doesn't work. Need to update radiobuton */}
      <div className="container-text-position">
        <FieldBuilder
          value={checkKeyInObj(fields.alignment.name)}
          {...fields.alignment}
          onChange={onChange}
          items={iconAlignment}
        />
        <FieldBuilder
          value={checkKeyInObj(fields.position.name)}
          {...fields.position}
          onChange={onChange}
          items={iconPosition}
        />
        <SVGInline
          className="radio-button-icon"
          svg={svgTextLetterSpacing}
          cleanup={['title']}
        />
      </div>
      <FieldBuilder
        className="container-input-textarea"
        inputClassName="input-text-area"
        value={checkKeyInObj(fields.text.name)}
        {...fields.text}
        onChange={onChange}
      />
      <div className="container-personalize">
        <button className="btn-personalize">Personalize</button>
      </div>
      <div className="container-additional-options">
        <div className="container-link-url">
          <FieldBuilder
            value={checkKeyInObj(fields.linkUrl.name)}
            {...fields.linkUrl}
            className="input-time-position"
            onChange={onChange}
          />
          <div>
            <button className="btn-personalize">Personalize</button>
          </div>
        </div>
        <div className="container-email-link">
          <FieldBuilder
            value={checkKeyInObj(fields.callNotifyAddress.name)}
            {...fields.callNotifyAddress}
            className="email-notify"
            labelClassName="email-notify-label"
            inputClassName="email-notify-input"
            onChange={onChange}
          />
          <div className="container-open-link">
            <span>Open Link In</span>
            <FieldBuilder
              value={valueSelect}
              {...fields.linkTarget}
              onChange={setValueSelect}
            />
          </div>

        </div>
        <div className="container-text-transform">
          <div className="container-text-transform-rotation">
            <span>Rotation</span>
            <FieldBuilder
              value={checkKeyInObj(fields.rotation.name)}
              {...fields.rotation}
              onChange={onChange}
            />
          </div>
          <div className="container-text-transform-transition">
            <span>Transition</span>
            <button className="btn-library">Open Library</button>
          </div>
          <div className="container-text-transform-font">
            <div>
              <span>Font Combination</span>
              <button className="btn-library">Open Library</button>
            </div>
          </div>
        </div>

      </div>
    </Fragment>
  );
};

Basic.propTypes = {
  checkKeyInObj: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.shape({
    start: PropTypes.object,
    end: PropTypes.object,
    text: PropTypes.object,
    linkTarget: PropTypes.object,
    linkUrl: PropTypes.object,
    callNotifyAddress: PropTypes.object,
    rotation: PropTypes.object,
    alignment: PropTypes.object,
    position: PropTypes.object,
  }),
};

export default Basic;
