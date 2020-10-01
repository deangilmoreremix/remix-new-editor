import React, { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import { TEXT_TO_SPEECH_SUCCESS, TEXT_TO_SPEECH_ERROR, ERROR_TEXT_SYMBOLS } from '../../lib/constants/text-info';
import { ASSET_TYPES } from '../../lib/constants/media';
import { LIBRARY_TABS } from '../../lib/constants/library';
import {
  VOICES,
  LANGUAGES,
  engineType,
  LANGUAGES_PRO,
  ENGINE_TYPE_VALUES,
  LANGUAGES_VALUES,
  DEFAULT_VOICES,
  maxSymbols,
} from '../../lib/constants/textToSpeech';
import { addToken, wrapTokens, unwrapTokens } from '../../lib/utils/tokens-helper';
import { tokenModes } from '../../lib/constants/tokens';

import useUIStore from '../hooks/useUIStore';
import useMediaStore from '../hooks/useMediaStore';
import useProjectStore from '../hooks/useProjectStore';
import useUserStore from '../hooks/useUserStore';

import FormSelect from '../form/FormSelect';
import FormRadioButton from '../form/FormRadioButton';
import { showError } from '../../lib/services/alertService';
import CloseButton from '../common/CloseButton';
import { LibrarySpinner } from './Loader';
import PersonalizeButton from '../common/personalization/PersonalizeButton';
import FormTokensTextArea from '../form/FormTokensTextArea';
import FormTextArea from '../form/FormTextArea';
// import SVGInline from 'react-svg-inline';
// import trashIcon from '../../public/static/svgImages/common/trash.svg';
// import svgVoice from '../../public/static/svgImages/common/voice.svg';
// import FormTextField from '../form/FormTextField';

const TextToSpeech = observer(() => {
  const { toggleRightBlock, isTimelineOpen, setLibraryType } = useUIStore();
  const { postTextToSpeech } = useMediaStore();
  const { showSuccess } = useProjectStore();
  const { getTextSpeechSymbols } = useUserStore();

  const [loading, setLoading] = useState(false);
  const [valueTextarea, setValueTextarea] = useState('');
  const [fallbackValue, setFallbackValue] = useState('');
  const [voice, setVoice] = useState();
  const [language, setLanguage] = useState(LANGUAGES[0].value);
  const [selectVoices, setSelectVoices] = useState(VOICES[LANGUAGES_VALUES.ENUS_STANDART]);
  const [voiceType, setVoiceType] = useState(engineType[0].value);
  const [caret, setCaret] = useState();
  const [symbols, setSymbols] = useState(null);

  // toDo: Code commented below should be used for upper(white) input
  // const [valueSelect, setValueSelect] = useState(2);
  // const selectItems = [
  //   { label: 'First item', value: 1 },
  //   { label: 'Second item', value: 2 },
  //   { label: 'New item', value: 3 },
  // ];
  // const [valueInput, setValueInput] = useState(null)
  //
  // const onChange = v => {
  //   const item = selectItems.filter(item => item.value === v);
  //   setValueSelect(item.value);
  // };

  const quantify = () => {
    getTextSpeechSymbols()
      .then(value => setSymbols(+value))
      .catch(() => showError(ERROR_TEXT_SYMBOLS.title));
  };

  const getValueLength = (value) => unwrapTokens(value).replace(/{{\w+}}/g, '').length;

  const maxCount = (value) => {
    if (!symbols) {
      return 0;
    }
    return symbols > value ? value : symbols;
  };

  const backToLibrary = () => {
    setLibraryType(LIBRARY_TABS.VOICE);
  };

  const getVoice = () => {
    setLoading(true);
    postTextToSpeech(
      voiceType,
      language,
      isPersonalizeText ? unwrapTokens(valueTextarea) : valueTextarea,
      voice,
      isPersonalizeText ? ASSET_TYPES.PERSONALIZED_VOICE : ASSET_TYPES.VOICE,
      isPersonalizeText ? fallbackValue : null,
    )
      .then(() => showSuccess(TEXT_TO_SPEECH_SUCCESS.title))
      .catch(() => showError(TEXT_TO_SPEECH_ERROR.title))
      .then(() => quantify())
      .finally(() => setLoading(false));
  };

  useEffect(() => quantify(), []);

  useEffect(() => {
    const item = LANGUAGES.find(languageItem => languageItem.value === language).value;
    const currentVoiceType = voiceType || ENGINE_TYPE_VALUES.STANDART;
    const currentVoice = item === LANGUAGES_VALUES.ENUS
      ? DEFAULT_VOICES[currentVoiceType] : VOICES[item];

    if (currentVoice) {
      setVoiceType(ENGINE_TYPE_VALUES.STANDART);
    }
  }, [language]);

  useEffect(() => {
    const item = LANGUAGES.find(languageItem => languageItem.value === language).value;
    const currentVoiceType = voiceType || ENGINE_TYPE_VALUES.STANDART;
    const currentVoice = item === LANGUAGES_VALUES.ENUS
      ? DEFAULT_VOICES[currentVoiceType] : VOICES[item];

    if (currentVoice) {
      setSelectVoices(currentVoice);
      setVoice(currentVoice[0].value);
    }
  }, [voiceType]);

  const itemsRadio = useMemo(() => {
    const modifiedEngineType = engineType.slice();

    if (language) {
      modifiedEngineType.forEach(item => {
        item.disabled = false;
      });
      modifiedEngineType[1].disabled = !LANGUAGES_PRO.some(({ value: languageItem }) => (
        languageItem === language
      ));
    } else {
      modifiedEngineType.forEach(item => {
        item.disabled = true;
      });
    }

    return modifiedEngineType;
  }, [language]);

  const onVoiceSelect = v => {
    const item = selectVoices.find(voiceItem => voiceItem.value === v).value;
    setVoice(item);
  };

  const onLanguageSelect = v => {
    const item = LANGUAGES.find(languageItem => languageItem.value === v).value;
    setLanguage(item);
  };

  const isPersonalizeText = useMemo(() => valueTextarea && unwrapTokens(valueTextarea).indexOf('{{') !== -1, [valueTextarea]);

  const isDisabledButton = useMemo(() => {
    if (isPersonalizeText) {
      return !fallbackValue;
    } else {
      return !valueTextarea;
    }
  }, [valueTextarea, fallbackValue, isPersonalizeText]);

  const maxTextSymbols = useMemo(() => {
    const value = isPersonalizeText ? maxSymbols.personalized : maxSymbols.text;
    return maxCount(value);
  }, [symbols, isPersonalizeText]);

  const maxFallbackSymbols = useMemo(() => (
    maxCount(maxSymbols.text)
  ), [symbols]);

  const textValueAreaLength = useMemo(() => (
    getValueLength(valueTextarea)
  ), [valueTextarea]);

  const handleChange = useCallback((text, data) => {
    setValueTextarea(text);
    setCaret(data.caretOffset);
  }, [maxTextSymbols]);

  const handleChangeFallback = useCallback((text) => {
    setFallbackValue(text);
  }, [maxFallbackSymbols]);

  const disabledPersonalizedVoice = useMemo(() => (
    getValueLength(valueTextarea) >= maxTextSymbols
  ), [valueTextarea, maxTextSymbols]);

  const onAddTextToken = useCallback((token) => {
    if (disabledPersonalizedVoice) {
      return;
    }
    const result = addToken(unwrapTokens(valueTextarea), token, caret);
    setValueTextarea(wrapTokens(result));
  }, [valueTextarea, caret, maxTextSymbols]);

  return (
    <div className={classnames('text-to-speech', { 'big-window': !isTimelineOpen })}>
      <div className="text-to-speech__title-wrapper">
        <span className="text-to-speech__title">TEXT TO SPEECH</span>
      </div>
      <div className="text-to-speech__content">
        {/* toDo: Code below should be used for upper(white) input */}
        {/* <div className="text-to-speech__input-wrapper"> */}
        {/* <FormTextField */}
        {/* inputClassName="text-to-speech__input" */}
        {/* type="input" */}
        {/* placeholder="Hello world!" */}
        {/* value={valueInput} */}
        {/* onChange={(v) => setValueInput(v)} */}
        {/* /> */}
        {/* <div className="text-to-speech__input-icon-left"> */}
        {/* <SVGInline */}
        {/* className="icon" */}
        {/* classSuffix="" */}
        {/* svg={svgVoice} */}
        {/* cleanup={['title']} */}
        {/* alt="Remove item" */}
        {/* data-tip="Remove item" */}
        {/* /> */}
        {/* </div> */}
        {/* <div className="text-to-speech__input-icon-right"> */}
        {/* <SVGInline */}
        {/* className="icon" */}
        {/* classSuffix="" */}
        {/* svg={trashIcon} */}
        {/* cleanup={['title']} */}
        {/* alt="Remove item" */}
        {/* data-tip="Remove item" */}
        {/* /> */}
        {/* <button onClick={() => onRemove(item)}
        className="icon icon-button svg-fix" type="button" /> */}
        {/* </div> */}
        {/* </div> */}
        <div className="text-to-speech__options">
          <div className="text-to-speech__left">
            <FormSelect
              label="Language"
              items={LANGUAGES}
              className="text-to-speech__select"
              value={language}
              onChange={onLanguageSelect}
            />
            <FormSelect
              label="Voice"
              items={selectVoices}
              className="text-to-speech__select"
              value={voice}
              onChange={onVoiceSelect}
            />
            <FormRadioButton
              items={itemsRadio}
              groupName="groupName"
              value={voiceType}
              containerClassName="text-to-speech__radio-container"
              radioClassName="text-to-speech__radio"
              onChange={setVoiceType}
            />
            <PersonalizeButton
              onAdd={onAddTextToken}
              text="Personalize Voice"
              disabled={disabledPersonalizedVoice}
              elementType={ASSET_TYPES.PERSONALIZED_VOICE}
              tokenModes={{
                plain: tokenModes.plain,
              }}
            />
          </div>
          <div className="text-to-speech__right">
            <div className="text-to-speech__text-wrapper">
              {isPersonalizeText && (
                <Fragment>
                  <FormTextArea
                    label="Fallback Value"
                    value={fallbackValue}
                    onChange={handleChangeFallback}
                    className="text-to-speech__textarea"
                    inputClassName="text-to-speech__textarea-input"
                    rows={6}
                    text
                    maxTextSymbols={maxFallbackSymbols}
                  />
                  <p className="text-to-speech__info">Required field</p>
                </Fragment>
              )}
              <FormTokensTextArea
                label="Text"
                inputClassName="text-to-speech__textarea"
                value={valueTextarea}
                onChange={handleChange}
                additionalFieldName="text"
                caretName="caretOffset"
                variant="multiline"
                updateCaret={(value) => setCaret(value.caretOffset)}
                maxTextSymbols={maxTextSymbols}
                symbolsCount={textValueAreaLength}
              />
            </div>
            <div className="text-to-speech__loader-btn-group-wrapper">
              <div className="text-to-speech__loader" />
              <div className="text-to-speech__btn-group">
                <button
                  onClick={getVoice}
                  className={classnames('btn-custom btn-speech-get', { 'btn-custom-disabled': isDisabledButton || loading })}
                  disabled={isDisabledButton}
                >
                  {loading ? <LibrarySpinner /> : <span>GET VOICE</span>}
                </button>

                <button className="btn-custom btn-open-library" onClick={backToLibrary}>Open Library</button>
              </div>
            </div>
          </div>
        </div>
        <div className="text-to-speech__notification">
          {symbols && (
            <p>
              The number of characters remaining is
              <span>{` ${symbols.toLocaleString('en')}`}</span>
              .
            </p>
          )}
          {isPersonalizeText && (
            <p>
              Each time you watch your video in the player,
              the number of available symbols will decrease.
            </p>
          )}
        </div>
      </div>
      <CloseButton onClick={() => toggleRightBlock(false)} />
    </div>
  );
});

export default TextToSpeech;
