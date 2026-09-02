import React, { useCallback, useMemo } from 'react';
import classnames from 'classnames';

import PropTypes from '../../../../lib/PropTypes';

import useUserStore from '../../../hooks/useUserStore';
import useProjectStore from '../../../hooks/useProjectStore';
import useUIStore from '../../../hooks/useUIStore';

import { addToken, wrapTokens } from '../../../../lib/utils/tokens-helper';
import {
  ADVANCED_GROUP,
  BOLD,
  CALL_NOTIFY_ADDRESS,
  DEFAULT_FONT,
  FIELD_TEXT,
  FONT_COLOR,
  FONT_DECORATIONS,
  FONT_FAMILY,
  HTML_FIELD_TEXT,
  HTML_LINK_URL,
  ITALICS,
  LABEL_CLICK_TO_PHONE,
  LINK_URL,
  LINKTARGET,
} from '../../../../lib/constants/popcorn';
import { DEFAULT_FONT_COLOR, SELECT_TARGETS } from '../../../../lib/constants/settings/text';
import { CHECKBOX, COLOR, CONTENTEDITABLE_TEXTAREA, INPUT, MULTILINE, SELECT } from '../../../../lib/constants/forms';
import { CARET_FIELDS } from '../../../../lib/constants/tokens';
import { WINDOW_TYPES } from '../../../../lib/constants/ui';
import { FEATURES } from '../../../../lib/constants/features';
import { HINTS } from '../../../../lib/constants/text-info';
import fonts from '../../../../lib/constants/fonts';
import GoogleFontsLoader from '../../../wizard/editor/GoogleFontsLoader';

import FieldBuilder from '../../../form/FieldBuilder';
import PersonalizeButton from '../../../common/personalization/PersonalizeButton';

const CombinedText = ({
  htmlText,
  text,
  id,
  caretOffset,
  onChange,
  htmlUrl,
  linkUrl,
  callNotifyAddress,
  linkTarget,
  fontFamily,
  fontDecorations,
  fontColor,
  combinedId,
}) => {
  const { setVoiceTextId } = useProjectStore();
  const { openTextToSpeech } = useUIStore();

  const selectFonts = useMemo(() => {
    const result = [];
    fonts.map(item => (result.push({ label: item, value: item })));
    return result;
  }, [fonts]);

  const {
    currentUser: user,
    isfeatureEnabled: checkStateFeature,
    textToSpeechStandardEnabled,
    textToSpeechNeuralEnabled,
    textToSpeechLimitedEnabled,
    clickToPhoneCall,
  } = useUserStore();

  const hint = useMemo(() => (clickToPhoneCall ? HINTS.LINK_URL_PHONE : HINTS.LINK_URL));

  const textToRender = useMemo(() => {
    if (htmlText !== undefined) {
      return htmlText;
    } else if (htmlText === undefined && text !== undefined) {
      return wrapTokens(text);
    }
  }, [htmlText, text]);

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

  const onAddTextToken = useCallback((token) => {
    const result = addToken(text, token, caretOffset);
    onChange({ text: result, htmlText: wrapTokens(result), combinedItemId: id });
  }, [text, caretOffset, onChange]);

  const openVoice = () => {
    setVoiceTextId({ id: combinedId, textId: id });
    openTextToSpeech(WINDOW_TYPES.TEXT_TO_SPEECH);
  };

  const urlToRender = useMemo(() => {
    if (htmlUrl !== undefined) {
      return htmlUrl;
    } else if (linkUrl !== undefined) {
      return wrapTokens(linkUrl);
    } else {
      return '';
    }
  }, [htmlUrl, linkUrl]);

  const handleChange = (option) => {
    onChange({ [FONT_DECORATIONS]: { ...fontDecorations, ...option } });
  };

  const handleChangeColor = (rgbColor) => {
    onChange({
      [Object.keys(rgbColor).join()]: Object.values(rgbColor).join(), combinedItemId: id,
    });
  };

  return (
    <div className="combined-settings__text">
      <p className="combined-settings__text-title">Text</p>

      <FieldBuilder
        className="input-textarea-container"
        inputClassName="input-text-area"
        value={textToRender}
        onChange={(field, options) => onChange({ ...field, ...options })}
        updateCaret={onChange}
        name={HTML_FIELD_TEXT}
        type={CONTENTEDITABLE_TEXTAREA}
        variant={MULTILINE}
        additionalFieldName={FIELD_TEXT}
        caretName={CARET_FIELDS[HTML_FIELD_TEXT]}
      />

      <div className={classnames('text-buttons-container', { 'text-buttons-container-once': !isViewVoiceBtn })}>
        {isViewVoiceBtn && (
          <button className="combined-settings__convert" onClick={openVoice}>Convert to Smart Speech</button>
        )}
        <PersonalizeButton onAdd={onAddTextToken} />
      </div>

      <div className="combined-settings__wrapper">
        <div className="combined-settings__fonts">
          <GoogleFontsLoader fonts={fonts} />
          <FieldBuilder
            value={fontFamily || DEFAULT_FONT}
            name={FONT_FAMILY}
            items={selectFonts}
            type={SELECT}
            label="Font"
            googleFonts
            group={ADVANCED_GROUP}
            onChange={onChange}
            className="font-section__input"
          />
        </div>

        <div className="font-decoration-container">
          <FieldBuilder
            value={fontDecorations.bold}
            name={BOLD}
            label="Bold"
            type={CHECKBOX}
            onChange={handleChange}
          />
          <FieldBuilder
            value={fontDecorations.italics}
            name={ITALICS}
            label="Italic"
            type={CHECKBOX}
            onChange={handleChange}
          />
        </div>
      </div>

      <FieldBuilder
        value={fontColor || DEFAULT_FONT_COLOR}
        name={FONT_COLOR}
        type={COLOR}
        label="Font color"
        group={ADVANCED_GROUP}
        onChange={handleChangeColor}
        className="font-color-container-input"
      />

      <div className="link-url-container">
        <FieldBuilder
          value={urlToRender}
          labelHint={hint}
          name={HTML_LINK_URL}
          type={CONTENTEDITABLE_TEXTAREA}
          placeholder="www.example.com"
          additionalFieldName={LINK_URL}
          caretName={CARET_FIELDS[HTML_LINK_URL]}
          className="input-url-position"
          onChange={(field, options) => onChange({ ...field, ...options })}
          label={user
          && user.features
          && checkStateFeature(FEATURES.REVOLUTION_CLICK_TO_PHONE_CALL)
            ? LABEL_CLICK_TO_PHONE : 'URL (Call-to-action)'}
          updateCaret={onChange}
        />
      </div>

      <div className="email-link-container">
        <div className="open-link-container">
          <span className="text-settings-label">Open Link In</span>
          <FieldBuilder
            value={linkTarget || '_blank'}
            name={LINKTARGET}
            type={SELECT}
            items={SELECT_TARGETS}
            onChange={onChange}
          />
        </div>

        <FieldBuilder
          value={callNotifyAddress || ''}
          name={CALL_NOTIFY_ADDRESS}
          type={INPUT}
          label="Email to notify about call attempt"
          placeholder="example@gmail.com"
          className="email-notify"
          labelClassName="email-notify-label"
          inputClassName="email-notify-input"
          onChange={onChange}
        />
      </div>
    </div>
  );
};

CombinedText.propTypes = {
  htmlText: PropTypes.string,
  text: PropTypes.string,
  id: PropTypes.string,
  caretOffset: PropTypes.number,
  onChange: PropTypes.func,
  htmlUrl: PropTypes.string,
  linkUrl: PropTypes.string,
  callNotifyAddress: PropTypes.string,
  linkTarget: PropTypes.string,
  fontFamily: PropTypes.string,
  fontDecorations: PropTypes.shape({
    bold: PropTypes.bool,
    italics: PropTypes.bool,
  }),
  fontColor: PropTypes.string,
  combinedId: PropTypes.string,
};

export default CombinedText;
