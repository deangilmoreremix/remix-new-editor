import React, { Fragment } from 'react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../../lib/PropTypes';
import FieldBuilder from '../../../form/FieldBuilder';
import { iconAlignment, iconPosition } from '../../../../lib/constants/settings/vrtext-element';
import { SETTINGS_MODAL } from '../../../../lib/constants/modals';
import svgTextLetterSpacing from '../../../../public/static/svgImages/text/basic_group/letter-spacing.svg';
import useUIStore from '../../../hooks/useUIStore';
import useModalStore from "../../../hooks/useModalStore";

const Basic = ({ values, fields, onChange }) => {
  const { openAnimation } = useUIStore();
  const { closeModal } = useModalStore();

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

  const openLibrary = () => {
    closeModal(SETTINGS_MODAL);
    openAnimation();
  };

  return (
    <Fragment>
      <div className="text-container">
        <div className="text-container-time">
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
      <div className="text-position-container">
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
        className="input-textarea-container"
        inputClassName="input-text-area"
        value={text || fields.text.default}
        {...fields.text}
        onChange={onChange}
      />
      <div className="personalize-container">
        <button className="btn-personalize">Personalize</button>
      </div>
      <div className="additional-options-container">
        <div className="link-url-container">
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
        <div className="email-link-container">
          <FieldBuilder
            value={callNotifyAddress || ''}
            {...fields.callNotifyAddress}
            className="email-notify"
            labelClassName="email-notify-label"
            inputClassName="email-notify-input"
            onChange={onChange}
          />
          <div className="open-link-container">
            <span>Open Link In</span>
            <FieldBuilder
              value={linkTarget || fields.linkTarget.default}
              {...fields.linkTarget}
              onChange={onChange}
            />
          </div>

        </div>
        <div className="text-transform-container">
          <div className="text-transform-container-rotation">
            <span>Rotation</span>
            <FieldBuilder
              value={rotation || fields.rotation.default}
              {...fields.rotation}
              onChange={onChange}
            />
          </div>
          <div className="text-transform-container-transition">
            <span>Animations</span>
            <button className="btn-library" onClick={() => openLibrary()}>Open Library</button>
          </div>
          <div className="text-transform-container-font">
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
