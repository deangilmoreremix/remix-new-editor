import React, { Fragment } from 'react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../../lib/PropTypes';
import FieldBuilder from '../../../form/FieldBuilder';
import { iconAlignment, iconPosition } from '../../../../lib/constants/settings/vrtext-element';

import svgTextLetterSpacing from '../../../../public/static/svgImages/text/basic_group/letter-spacing.svg';

const Basic = ({ values, fields, onChange }) => {
  const {
    start,
    end,
    alignment,
    position,
    text,
    linkUrl,
    linkTarget,
    callNotifyAddress,
    rotation,
  } = values;

  return (
    <Fragment>
      <div className="container-text">
        <div className="container-text-time">
          <FieldBuilder
            value={start || fields.start.default}
            {...fields.start}
            className="input-time-position"
            onChange={onChange}
          />
          <FieldBuilder
            value={end || fields.end.default}
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
          value={alignment || fields.alignment.default}
          {...fields.alignment}
          onChange={onChange}
          items={iconAlignment}
        />
        <FieldBuilder
          value={position || fields.position.default}
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
        value={text || fields.text.default}
        {...fields.text}
        onChange={onChange}
      />
      <div className="container-personalize">
        <button className="btn-personalize">Personalize</button>
      </div>
      <div className="container-additional-options">
        <div className="container-link-url">
          <FieldBuilder
            value={linkUrl || ''}
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
            value={callNotifyAddress || ''}
            {...fields.callNotifyAddress}
            className="email-notify"
            labelClassName="email-notify-label"
            inputClassName="email-notify-input"
            onChange={onChange}
          />
          <div className="container-open-link">
            <span>Open Link In</span>
            <FieldBuilder
              value={linkTarget || fields.linkTarget.default}
              {...fields.linkTarget}
              onChange={onChange}
            />
          </div>

        </div>
        <div className="container-text-transform">
          <div className="container-text-transform-rotation">
            <span>Rotation</span>
            <FieldBuilder
              value={rotation || fields.rotation.default}
              {...fields.rotation}
              onChange={onChange}
            />
          </div>
          <div className="container-text-transform-transition">
            <span>Animations</span>
            <button className="btn-library" onClick={() => console.log('todo')}>Open Library</button>
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
  values: PropTypes.shape(PropTypes.object),
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.shape(PropTypes.object),
};

export default Basic;
