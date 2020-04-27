import React, { Fragment } from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';

import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';
import useUIStore from '../../../hooks/useUIStore';
import { iconAlignment, iconPosition } from '../../../../lib/constants/settings/vrtext-element';

import svgTextLetterSpacing from '../../../../public/static/svgImages/text/basic_group/letter-spacing.svg';

import PersonalizeButton from '../../../common/personalization/PersonalizeButton';

const Basic = observer(({ values, fields, onChange, closeModal }) => {
  const { openAnimation } = useUIStore();

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
    type,
  } = values;

  const openLibrary = () => {
    closeModal();
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
        <span className="text-settings-label">Text Position</span>
      </div>
      <div>
        <div className="text-position-container">
          <span className="text-position-container-label text-settings-label">Text</span>
          <div className="text-position-container-icons">
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
        </div>
        <FieldBuilder
          className="input-textarea-container"
          inputClassName="input-text-area"
          value={typeof (text) !== 'undefined' ? text : fields.text.default}
          {...fields.text}
          onChange={onChange}
        />
      </div>
      <PersonalizeButton />
      <div>
        <div className="link-url-container">
          <FieldBuilder
            value={linkUrl || ''}
            {...fields.linkUrl}
            className="input-url-position"
            onChange={onChange}
          />
          <PersonalizeButton />
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
            <span className="text-settings-label">Open Link In</span>
            <FieldBuilder
              value={linkTarget || fields.linkTarget.default}
              {...fields.linkTarget}
              onChange={onChange}
            />
          </div>

        </div>
        <div className="text-transform-container">
          <div className="text-transform-container-rotation">
            <FieldBuilder
              className="text-transform-container-input"
              value={rotation || fields.rotation.default}
              {...fields.rotation}
              onChange={onChange}
            />
          </div>
          <div className="text-transform-container-transition">
            <span className="text-settings-label">Animations</span>
            <button className="btn-library" onClick={() => openLibrary()}>Open Library</button>
          </div>
          <div className="text-transform-container-font">
            <div>
              <span className="text-settings-label">Font Combination</span>
              <button className="btn-library">Open Library</button>
            </div>
          </div>
        </div>

      </div>
    </Fragment>
  );
});

Basic.propTypes = {
  values: PropTypes.shape({
    start: PropTypes.number,
    end: PropTypes.number,
    alignment: PropTypes.string,
    position: PropTypes.string,
    text: PropTypes.string,
    linkUrl: PropTypes.string,
    callNotifyAddress: PropTypes.string,
    linkTarget: PropTypes.string,
    rotation: PropTypes.string,
    type: PropTypes.string,
  }),
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.shape({
    start: PropTypes.shape({}),
    end: PropTypes.shape({}),
    alignment: PropTypes.shape({}),
    position: PropTypes.shape({}),
    text: PropTypes.shape({}),
    linkUrl: PropTypes.shape({}),
    callNotifyAddress: PropTypes.shape({}),
    linkTarget: PropTypes.shape({}),
    rotation: PropTypes.shape({}),
  }),
  closeModal: PropTypes.func,
};

export default Basic;
