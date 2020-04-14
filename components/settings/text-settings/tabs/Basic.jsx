import React, { Fragment, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../../lib/PropTypes';
import FieldBuilder from '../../../form/FieldBuilder';
import FormRadioButton from '../../../form/FormRadioButton';

import svgTextLeft from '../../../../public/static/svgImages/text/basic_group/text-icon-left.svg';
import svgTextCenter from '../../../../public/static/svgImages/text/basic_group/text-icon-center.svg';
import svgTextRight from '../../../../public/static/svgImages/text/basic_group/text-icon-right.svg';
import svgTextPositionTop from '../../../../public/static/svgImages/text/basic_group/text-position-top.svg';
import svgTextPositionCenter from '../../../../public/static/svgImages/text/basic_group/text-position-center.svg';
import svgTextPositionBottom from '../../../../public/static/svgImages/text/basic_group/text-position-bottom.svg';
import svgTextLetterSpacing from '../../../../public/static/svgImages/text/basic_group/letter-spacing.svg';

const iconAlignment = [
  { icon: svgTextLeft },
  { icon: svgTextCenter },
  { icon: svgTextRight },
];
const iconPosition = [
  { icon: svgTextPositionTop },
  { icon: svgTextPositionCenter },
  { icon: svgTextPositionBottom },
];

const Basic = ({ values, fields, onChange }) => {
  const [valueSelect, setValueSelect] = useState(fields.linkTarget.items[0]);

  return (
    <Fragment>
      <div className="container-text">
        <div className="container-text-time">
          <FieldBuilder
            value={values && values.start !== undefined ? values.start : fields.start.default}
            {...fields.start}
            name={fields.start.name}
            className="input-time-position"
            onChange={onChange}
          />
          <FieldBuilder
            value={values && values.end !== undefined ? values.end : fields.end.default}
            {...fields.end}
            name={values.end.name}
            className="input-time-position"
            onChange={onChange}
          />
        </div>
        <span>Text Position</span>
      </div>
      {/* todo icons doesn't work. Need to update radiobuton */}
      <div className="container-text-position">
        <FormRadioButton
          type="radio"
          onChange={onChange}
          items={iconAlignment}
        />
        <FormRadioButton
          type="radio"
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
        value={values && values.text !== undefined ? values.text : fields.text.default}
        {...fields.text}
        name={fields.text.name}
        onChange={onChange}
      />
      <div className="container-personalize">
        <button className="btn-personalize">Personalize</button>
        <FontAwesomeIcon icon={faQuestionCircle} className="fa-inverse" />
      </div>
        <div className="container-additional-options">
          {/* <span>Link Url or Phone number</span> */}
          <div className="container-link-url">
            <FieldBuilder
              value={values && values.linkUrl !== undefined ? values.linkUrl : fields.linkUrl.default}
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
              value={values && values.callNotifyAddress !== undefined ? values.callNotifyAddress : fields.callNotifyAddress.default}
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
                value={valueSelect}
                {...fields.linkTarget}
                name={fields.linkTarget.name}
                onChange={setValueSelect}
              />
            </div>

          </div>
          <div className="container-text-transform">
            <div className="container-text-transform-rotation">
              <span>Rotation</span>
              <FieldBuilder
                value={values && values.rotation !== undefined ? values.rotation : fields.rotation.default}
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
    </Fragment>
  );
};

Basic.propTypes = {
  values: PropTypes.shape({
    start: PropTypes.number,
    end: PropTypes.number,
    text: PropTypes.string,
    linkUrl: PropTypes.string,
    callNotifyAddress: PropTypes.string,
    rotation: PropTypes.number,
  }),
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.shape({
    start: PropTypes.number,
    end: PropTypes.number,
    text: PropTypes.string,
    linkTarget: PropTypes.arrayOf(PropTypes.string),
    linkUrl: PropTypes.string,
    callNotifyAddress: PropTypes.string,
    rotation: PropTypes.number,
  }),
};

export default Basic;
