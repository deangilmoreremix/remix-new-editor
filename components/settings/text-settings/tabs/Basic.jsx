import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react';

import FieldBuilder from '../../../form/FieldBuilder';
import SetAsDefaultCheckbox from '../../default-settings/SetAsDefaultCheckbox';
import PersonalizeButton from '../../../common/personalization/PersonalizeButton';


import useUIStore from '../../../hooks/useUIStore';
import useUserStore from '../../../hooks/useUserStore';

import {
  padding,
  TEXT_POSITION,
  iconPositionVertical,
  iconAlignmentHorizontal,
} from '../../../../lib/constants/settings/vrtext-element';
import { FEATURES } from '../../../../lib/constants/features';
import { LABEL_CLICK_TO_PHONE } from '../../../../lib/constants/popcorn';

import { addToken, wrapTokens } from '../../../../lib/utils/tokens-helper';

import PropTypes from '../../../../lib/PropTypes';

import { HINTS } from '../../../../lib/constants/text-info';

const Basic = observer(({ values, fields, element, onChange }) => {
  const [positionHorizontal, setPositionHorizontal] = useState();
  const [positionVertical, setPositionVertical] = useState();

  const { openAnimation } = useUIStore();
  const {
    currentUser: user,
    isfeatureEnabled: checkStateFeature,
    clickToPhoneCall,
  } = useUserStore();

  const {
    start,
    end,
    text,
    caretOffset,
    urlCaretOffset,
    htmlText,
    linkUrl,
    htmlUrl,
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

  const onAddUrlToken = useCallback((token) => {
    const result = addToken(linkUrl, token, urlCaretOffset);
    onChange({ linkUrl: result, htmlUrl: wrapTokens(result) });
  }, [linkUrl, urlCaretOffset, onChange]);

  useEffect(() => {
    if (width) {
      setPositionHorizontal(null);
    }
  }, [width]);

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

  const urlToRender = useMemo(() => {
    if (htmlUrl !== undefined) {
      return htmlUrl;
    } else if (linkUrl !== undefined) {
      return wrapTokens(linkUrl);
    } else {
      return '';
    }
  }, [htmlUrl, linkUrl]);

  const hint = useMemo(() => (clickToPhoneCall ? HINTS.LINK_URL_PHONE : HINTS.LINK_URL));

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
            />
            <FieldBuilder
              value={positionVertical || null}
              {...fields.position}
              onChange={changePositionVertical}
              items={iconPositionVertical}
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
      <PersonalizeButton onAdd={onAddTextToken} />
      <div>
        <div className="link-url-container">
          <FieldBuilder
            value={urlToRender}
            labelHint={hint}
            {...fields.htmlUrl}
            className="input-url-position"
            onChange={onChange}
            label={user
            && user.features
            && checkStateFeature(FEATURES.REVOLUTION_CLICK_TO_PHONE_CALL)
              ? LABEL_CLICK_TO_PHONE : fields.htmlUrl.label}
            updateCaret={(value) => onChange({ urlCaretOffset: value })}
          />
          <PersonalizeButton onAdd={onAddUrlToken} />
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

export default Basic;
