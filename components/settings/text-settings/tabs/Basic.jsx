import React, { Fragment, useState } from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import PropTypes from '../../../../lib/PropTypes';
import FieldBuilder from '../../../form/FieldBuilder';
import svgArrowBottom from '../../../../public/static/svgImages/text/arrow-bottom.svg';

// const resLinkTargetValue = { 'New Tab': '_blank', 'Current Tab': '_parent' };
// const switchLinkTargetUI = {
//   _blank: DEFAULT_FIELDS[OPEN_LINK].items[0],
//   _parent: DEFAULT_FIELDS[OPEN_LINK].items[1],
// };

const Basic = ({ values, fields, onChange }) => {
  const [additionalOptions, setAdditionalOptions] = useState(false);

  const isValuePresent = val => (val !== undefined ? val : fields[val].default);

  const handleChangeLinkTarget = () => {
    // onChange({ linkTarget: resLinkTargetValue[e.linkTarget] });
  };

  return (
    <Fragment>
      <div className="container-text">
        <div className="container-text-time">
          <FieldBuilder
            value={isValuePresent(values.start)}
            {...fields.start}
            name={fields.start.name}
            className="input-time-position"
            onChange={onChange}
          />
          <FieldBuilder
            value={isValuePresent(values.end)}
            {...fields.end}
            name={values.end.name}
            className="input-time-position"
            onChange={onChange}
          />
        </div>
        <span>Text Position</span>
      </div>
      <div className="container-text-position">
        {/* todo need update after adding styles and reformate FormRadioButton for SVG as well */}
      </div>
      <FieldBuilder
        className="container-input-textarea"
        inputClassName="input-text-area"
        value={isValuePresent(values.text)}
        {...fields.text}
        name={fields.text.name}
        onChange={onChange}
      />
      <div className="container-personalize">
        <button className="btn-personalize">Personalize</button>
        <FontAwesomeIcon icon={faQuestionCircle} className="fa-inverse" />
      </div>
      {/* eslint-disable-next-line max-len */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events */}
      <div
        className="container-icon-arrow"
        onClick={() => setAdditionalOptions(!additionalOptions)}
      >
        <SVGInline
          className={classnames('icon-arrow', { 'icon-arrow-rotate': additionalOptions })}
          classSuffix="-inline"
          svg={svgArrowBottom}
          cleanup={['title']}
        />
      </div>
      {additionalOptions && (
        <div className="container-additional-options">
          {/* <span>Link Url or Phone number</span> */}
          <div className="container-link-url">
            <FieldBuilder
              value={isValuePresent(values.linkUrl)}
              {...fields.linkUrl}
              name={fields.linkUrl.name}
              className="input-time-position"
              onChange={onChange}
            />
            <div>
              <button className="btn-personalize">Personalize</button>
            </div>
          </div>
          <div className="container-email-link">
            <FieldBuilder
              value={isValuePresent(values.callNotifyAddress)}
              {...fields.callNotifyAddress}
              name={fields.callNotifyAddress.name}
              className="email-notify"
              labelClassName="email-notify-label"
              inputClassName="email-notify-input"
              onChange={onChange}
            />
            <div className="container-open-link">
              <span>Open Link In</span>
              <FieldBuilder
                value={isValuePresent(values.linkTarget)}
                {...fields.linkTarget}
                name={fields.linkTarget.name}
                onChange={handleChangeLinkTarget}
              />
            </div>

          </div>
          <div className="container-text-transform">
            <div className="container-text-transform-rotation">
              <span>Rotation</span>
              <FieldBuilder
                value={isValuePresent(values.rotation)}
                name={fields.rotation.name}
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
      )}
    </Fragment>
  );
};

Basic.propTypes = {
  values: PropTypes.shape({}),
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.shape({}),
};

export default Basic;
