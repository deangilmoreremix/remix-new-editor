import React, {Fragment, useState} from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faQuestionCircle} from '@fortawesome/free-solid-svg-icons';
import FormTextField from '../../../form/FormTextField';
import FormCheckboxField from '../../../form/FormCheckboxField';
import AngleCircle from '../../../form/AngleCircle';
import AngleInput from '../../../form/AngleInput';
import svgArrowBottom from '../../../../public/static/images/text/arrow-bottom.svg';
import FieldBuilder from '../../../form/FieldBuilder';
import {
  ADVANCED_FIELDS, BACKGROUND,
  BACKGROUND_COLOR, FONT_DECORATIONS, FONT_DECORATIONS_BOLD,
  SHADOW_COLOR,
  STROKE_COLOR,
  INPUT_TEXT_ROTATION, TEXT,
  START, END, LINK_URL, CALL_TO_NOTIFY, OPEN_LINK,
} from '../../../../lib/constants/settings/vrtext-preset';

const switchLinkTarget = {
  _blank: ADVANCED_FIELDS[OPEN_LINK].items[0],
  _parent: ADVANCED_FIELDS[OPEN_LINK].items[1],
};
const resLinkTargetValue = { 'New Tab': '_blank', 'Current Tab': '_parent' };

const Basic = ({options, onChange}) => {
  const [additionalOptions, setAdditionalOptions] = useState(false);

  const handleChangeLinkTarget = (e) => {
    onChange({ linkTarget: resLinkTargetValue[e.linkTarget] });
  };

  return (
    <Fragment>
      <div className="container-text">
        <div className="container-text-time">
          <FieldBuilder
            value={options[START]}
            {...ADVANCED_FIELDS[START]}
            name={START}
            className="input-time-position"
            onChange={onChange}
          />
          <FormTextField
            value="sdsad"
            className="input-time-position"
            placeholder="Placeholder"
            onChange={() => {
              console.log('onChange');
            }}
            onEnter={() => {
              console.log('onEnter');
            }}
            id="standard-read-only-input"
            defaultValue="Hello World"
          />
        </div>
        <span>Text Position</span>
      </div>
      <div className="container-text-position">
        <FormCheckboxField/>
        <FormCheckboxField/>
        <FormCheckboxField/>
        <FormCheckboxField/>
        <FormCheckboxField/>
      </div>
      <FieldBuilder
        className="container-input-textarea"
        inputClassName="input-text-area"
        value={options[TEXT]}
        {...ADVANCED_FIELDS[TEXT]}
        name={TEXT}
        onChange={onChange}
      />
      <div className="container-personalize">
        <button className="btn-personalize">Personalize</button>
        <FontAwesomeIcon icon={faQuestionCircle} className="fa-inverse"/>
      </div>
      <div className="container-icon-arrow" onClick={() => setAdditionalOptions(!additionalOptions)}>
        <SVGInline
          className={classnames('icon-arrow', {'icon-arrow-rotate': additionalOptions})}
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
              value={options[LINK_URL]}
              {...ADVANCED_FIELDS[LINK_URL]}
              name={LINK_URL}
              className="input-time-position"
              onChange={onChange}
            />
            <div>
              <button className="btn-personalize">Personalize</button>
            </div>
          </div>
          <div className="container-email-link">
            <FieldBuilder
              value={options[CALL_TO_NOTIFY]}
              {...ADVANCED_FIELDS[CALL_TO_NOTIFY]}
              name={CALL_TO_NOTIFY}
              className="email-notify"
              labelClassName="email-notify-label"
              inputClassName="email-notify-input"
              onChange={onChange}
            />
            <div className="container-open-link">
              <span>Open Link In</span>
              <FieldBuilder
                value={switchLinkTarget[options[OPEN_LINK]]}
                {...ADVANCED_FIELDS[OPEN_LINK]}
                name={OPEN_LINK}
                onChange={handleChangeLinkTarget}
              />
            </div>

          </div>
          <div className="container-text-transform">
            <div className="container-text-transform-rotation">
              <span>Rotation</span>
              <FieldBuilder
                value={options[INPUT_TEXT_ROTATION]}
                name={INPUT_TEXT_ROTATION}
                {...ADVANCED_FIELDS[INPUT_TEXT_ROTATION]}
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
Basic.propTypes = {};

export default Basic;
