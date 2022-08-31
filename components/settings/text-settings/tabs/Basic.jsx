import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import FieldBuilder from '../../../form/FieldBuilder';
import FormSelect from '../../../form/FormSelect';
import SetAsDefaultCheckbox from '../../default-settings/SetAsDefaultCheckbox';
import PersonalizeButton from '../../../common/personalization/PersonalizeButton';


import useUIStore from '../../../hooks/useUIStore';
import useUserStore from '../../../hooks/useUserStore';
import useProjectStore from '../../../hooks/useProjectStore';
import { PHONEAREACODE } from '../../../../lib/constants/phoneAreaCode';

import {
  padding,
  TEXT_POSITION,
  iconPositionVertical,
  iconAlignmentHorizontal,
} from '../../../../lib/constants/settings/vrtext-element';
import { FEATURES } from '../../../../lib/constants/features';
import { LABEL_CLICK_TO_PHONE, LABEL_CLICK_TO_URL } from '../../../../lib/constants/popcorn';
import { WINDOW_TYPES } from '../../../../lib/constants/ui';
import { HINTS } from '../../../../lib/constants/text-info';

import { addToken, wrapTokens } from '../../../../lib/utils/tokens-helper';

import PropTypes from '../../../../lib/PropTypes';

import withValidation from '../../../hoc/withValidation';
const areaCodeList = [
  { label: 'All', value: null },
  ...PHONEAREACODE,
];

const Basic = observer(({ values, fields, element, onChange, checkValue }) => {
  const [positionHorizontal, setPositionHorizontal] = useState();
  const [positionVertical, setPositionVertical] = useState();
  const [val, setVal] = useState("URL");
  const [code, setCode] = useState("");
  const [ctaVal,setCtaVal] = useState("");
  const { setVoiceTextId } = useProjectStore();
  const { openAnimation, openTextToSpeech } = useUIStore();
  const {
    currentUser: user,
    isfeatureEnabled: checkStateFeature,
    clickToPhoneCall,
    textToSpeechStandardEnabled,
    textToSpeechNeuralEnabled,
    textToSpeechLimitedEnabled,
  } = useUserStore();

  const {
    start,
    end,
    text,
    caretOffset,
    htmlText,
    linkUrl,
    linkTarget,
    callNotifyAddress,
    rotation,
    width,
    height,
    left,
    top,
  } = values;

  const elementWidth = React.useMemo(() => width || fields.width.default, [width]);
  const elementHeight = React.useMemo(() => height || fields.height.default, [width]);

  const onAddTextToken = useCallback((token) => {
    const result = addToken(text, token, caretOffset);
    onChange({ text: result, htmlText: wrapTokens(result) });
  }, [text, caretOffset, onChange]);

  // const onAddUrlToken = useCallback((token) => {
  //   const result = addToken(linkUrl, token, urlCaretOffset);
  //   onChange({ linkUrl: result, htmlUrl: wrapTokens(result) });
  // }, [linkUrl, urlCaretOffset, onChange]);

  useEffect(() => {
    if (width) {
      setPositionHorizontal(null);
    }
  }, [width]);

  useEffect(() => {
    const ctaValue = Number(linkUrl)
    if(ctaValue) {
      setCtaVal("PHONE");
    }
    else {
      setCtaVal("URL");
    }
  },[linkUrl])

  useEffect(() => {
    switch (left) {
      case padding:
        setPositionHorizontal(TEXT_POSITION.LEFT);
        break;
      case (100 - elementWidth) / 2:
        setPositionHorizontal(TEXT_POSITION.CENTER);
        break;
      case 100 - (elementWidth + padding):
        setPositionHorizontal(TEXT_POSITION.RIGHT);
        break;
      default:
        setPositionHorizontal(null);
        break;
    }
  }, [left, elementWidth]);

  useEffect(() => {
    switch (top) {
      case padding:
        setPositionVertical(TEXT_POSITION.TOP);
        break;
      case (100 - (elementHeight + (padding * 2))) / 2:
        setPositionVertical(TEXT_POSITION.MIDDLE);
        break;
      case (100 - (elementHeight + padding)):
        setPositionVertical(TEXT_POSITION.BOTTOM);
        break;
      default:
        setPositionVertical(null);
        break;
    }
  }, [top, elementHeight]);

  useEffect(() => {
    if (height) {
      setPositionVertical(null);
    }
  }, [height]);

  const changePositionHorizontal = useCallback(
    (field) => {
      const position = field.alignment;

      switch (position) {
        case TEXT_POSITION.LEFT:
          onChange({ left: padding });
          break;
        case TEXT_POSITION.CENTER:
          onChange({ left: (100 - elementWidth) / 2 });
          break;
        case TEXT_POSITION.RIGHT:
          onChange({ left: 100 - (elementWidth + padding) });
          break;
        default:
          onChange({ left: padding });
          break;
      }
    }, [elementWidth],
  );

  const changePositionVertical = useCallback(
    (field) => {
      const { position } = field;

      switch (position) {
        case TEXT_POSITION.TOP:
          onChange({ top: padding });
          break;
        case TEXT_POSITION.MIDDLE:
          onChange({ top: (100 - (elementHeight + (padding * 2))) / 2 });
          break;
        case TEXT_POSITION.BOTTOM:
          onChange({ top: (100 - (elementHeight + padding)) });
          break;
        default:
          onChange({ top: padding });
          break;
      }
    }, [elementHeight],
  );

  const textToRender = useMemo(() => {
    if (htmlText !== undefined) {
      return htmlText;
    } else if (htmlText === undefined && text !== undefined) {
      return wrapTokens(text);
    } else {
      return fields.htmlText.default;
    }
  }, [htmlText, text, fields]);

  const hint = useMemo(() => (clickToPhoneCall ? HINTS.LINK_URL_PHONE : HINTS.LINK_URL));
  const isViewVoiceBtn = useMemo(() => {
    if (textToRender
      && (textToSpeechStandardEnabled || textToSpeechNeuralEnabled || textToSpeechLimitedEnabled)) {
      return true;
    }
    return false;
  }, [textToRender,
    textToSpeechStandardEnabled,
    textToSpeechNeuralEnabled,
    textToSpeechLimitedEnabled,
  ]);

  const openVoice = () => {
    setVoiceTextId();
    openTextToSpeech(WINDOW_TYPES.TEXT_TO_SPEECH);
  };

  const onCodeSelect = v => {
    const item = areaCodeList.find(areaCodeItem => areaCodeItem.value === v).value;
    setCode(item);
  };
  const onChangeWithValidation = (v, error) => {
    if (!error) {
      if (code) {
        v.linkUrl = `${code + v.linkUrl}`;
      }
      onChange(v);
    }
  };

  const onChangeHandler = (event) => {
    setVal(event.target.value);
  }
  return (
    <Fragment>
      <div className="text-container">
        <div className="text-container-time">
          <FieldBuilder
            value={start || fields.start.default}
            {...fields.start}
            className="input-time-position"
            onChange={onChange}
            element={element}
          />
          <FieldBuilder
            value={end || fields.end.default}
            {...fields.end}
            className="input-time-position"
            onChange={onChange}
            element={element}
          />
        </div>
        <span className="text-settings-label">Text Position</span>
      </div>
      <div>
        <div className="text-position-container">
          <span className="text-position-container-label text-settings-label">Text</span>
          <div className="text-position-container-icons">
            <FieldBuilder
              value={positionHorizontal || null}
              {...fields.alignment}
              onChange={changePositionHorizontal}
              items={iconAlignmentHorizontal}
              row
            />
            <FieldBuilder
              value={positionVertical || null}
              {...fields.position}
              onChange={changePositionVertical}
              items={iconPositionVertical}
              row
            />
          </div>
        </div>
        <FieldBuilder
          className="input-textarea-container"
          inputClassName="input-text-area"
          value={textToRender}
          {...fields.htmlText}
          onChange={onChange}
          updateCaret={(value) => onChange({ caretOffset: value })}
        />
      </div>
      <div className={classnames('text-buttons-container', { 'text-buttons-container-once': !isViewVoiceBtn })}>
        {isViewVoiceBtn && (
          <button className="open-text-to-speech" onClick={openVoice}>Convert to Smart Speech</button>
        )}
        <PersonalizeButton onAdd={onAddTextToken} />
      </div>
      <div className='text-cta-container'>
        <div onChange={onChangeHandler}>
          <input type="radio" value="URL" name="cta" defaultChecked /> URL
          <input type="radio" value="PHONE" name="cta" /> PHONE
        </div>
        {val == 'URL' ?
          <div className="link-url-container">
            <FieldBuilder
              checkValue={checkValue}
              value={ctaVal == 'URL' ? linkUrl : ''}
              labelHint={HINTS.LINK_URL}
              {...fields.linkUrl}
              className="input-url-position"
              onChange={onChangeWithValidation}
              label={user
                && user.features
                && checkStateFeature(FEATURES.REVOLUTION_CLICK_TO_PHONE_CALL)
                ? LABEL_CLICK_TO_URL : fields.linkUrl.label}
            />
          </div>
          :
          <div >
            <div className="phone-area-code-container">
              <div className="phone-code">
                <FormSelect
                  label="Phone Number (Click-to-call)"
                  items={areaCodeList}
                  value={code}
                  onChange={onCodeSelect}
                  selectClassName={'area_code_class'}
                />
              </div>

              <div className="link-url-container">
                <FieldBuilder
                  checkValue={checkValue}
                  value={ctaVal == 'PHONE' ? linkUrl : ''}
                  labelHint={HINTS.PHONE_FORM}
                  {...fields.linkUrl}
                  className="input-url-position"
                  onChange={onChangeWithValidation}
                  label={""}

                />
          {/* <PersonalizeButton onAdd={onAddUrlToken} /> */}
              </div>
            </div>
          </div>


        }

        <div className="email-link-container">
          <FieldBuilder
            checkValue={checkValue}
            value={callNotifyAddress || ''}
            {...fields.callNotifyAddress}
            className="email-notify"
            labelClassName="email-notify-label"
            inputClassName="email-notify-input"
            onChange={onChangeWithValidation}
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
            <button className="btn-library" onClick={() => openAnimation()}>Open Library</button>
          </div>
          {/* <div className="text-transform-container-font"> */}
          {/* <div> */}
          {/* <span className="text-settings-label">Font Combination</span> */}
          {/* <button className="btn-library">Open Library</button> */}
          {/* </div> */}
          {/* </div> */}
        </div>
      </div>
      <div className="set-as-default">
        <SetAsDefaultCheckbox />
      </div>
    </Fragment>
  );
});

Basic.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    popcornOptions: PropTypes.shape().isRequired,
    track: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]).isRequired,
  }).isRequired,
  values: PropTypes.shape({
    start: PropTypes.number,
    end: PropTypes.number,
    alignment: PropTypes.string,
    position: PropTypes.string,
    htmlText: PropTypes.string,
    linkUrl: PropTypes.string,
    callNotifyAddress: PropTypes.string,
    linkTarget: PropTypes.string,
    rotation: PropTypes.string,
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

export default withValidation(Basic);
