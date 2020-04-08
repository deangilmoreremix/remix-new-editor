import React, {Fragment, useState} from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';
import FormTextField from '../../../form/FormTextField';
import FormCheckboxField from '../../../form/FormCheckboxField';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faQuestionCircle} from '@fortawesome/free-solid-svg-icons';
import svgArrowBottom from "../../../../public/static/images/text/arrow-bottom.svg";
import FieldBuilder from "../../../form/FieldBuilder";
import {
  ADVANCED_FIELDS, BACKGROUND,
  BACKGROUND_COLOR,
  SHADOW_COLOR,
  STROKE_COLOR
} from "../../../../lib/constants/settings/vrtext-preset";


const Basic = ({options, onChange}) => {
  const [additionalOptions, setAdditionalOptions] = useState(false);

  return (
    <Fragment>
      <div className="container-text">
        <div className="container-text-time">
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
            InputProps={{
              readOnly: true,
            }}
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
        <span>Text</span>
        <FormCheckboxField/>
        <FormCheckboxField/>
        <FormCheckboxField/>
        <FormCheckboxField/>
        <FormCheckboxField/>
      </div>
      <FormTextField
        id="outlined-multiline-static"
        label="Multiline"
        multiline
        rows="10"
        defaultValue="Default Value"
        variant="outlined"
      />
      <div className="container-personalize">
        <button className="btn-personalize">Personalize</button>
          <FontAwesomeIcon icon={faQuestionCircle} className="fa-inverse" />
      </div>
      <div className="container-icon-arrow" onClick={() => setAdditionalOptions(!additionalOptions)}>
        <SVGInline
          className={classnames('icon-arrow', { 'icon-arrow-rotate': additionalOptions })}
          classSuffix="-inline"
          svg={svgArrowBottom}
          cleanup={['title']}
        />
      </div>
      {additionalOptions && (
        <div className="container-additional-options">
          {/*<span>Link Url or Phone number</span>*/}
          <div className="container-link-url">
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
              label="Link Url or Phone number"
              id="standard-read-only-input"
              defaultValue="Hello World"
            />
            <div>
              <button className="btn-personalize">Personalize</button>
            </div>
          </div>
          <div className="container-email-link">
            <FormTextField
              value="sdsad"
              className="email-notify"
              labelClassName="email-notify-label"
              inputClassName="email-notify-input"
              placeholder="Placeholder"
              onChange={() => {
                console.log('onChange');
              }}
              onEnter={() => {
                console.log('onEnter');
              }}
              label="Email to notify about call attempt"
              id="standard-read-only-input"
              defaultValue="Hello World"
            />
            <FormTextField
              value="a"
              className="open-link"
              labelClassName="open-link-label"
              inputClassName="open-link-input"
              placeholder="Placeholder"
              onChange={() => {
                console.log('onChange');
              }}
              onEnter={() => {
                console.log('onEnter');
              }}
              label="Open link in"
              id="standard-read-only-input"
              defaultValue="Hello World"
            />
          </div>
        </div>
      )}

    </Fragment>
  );
};
Basic.propTypes = {};

export default Basic;
