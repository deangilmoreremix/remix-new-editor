import React, { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import { TEXT_TO_SPEECH_SUCCESS, TEXT_TO_SPEECH_ERROR } from '../../lib/constants/text-info';
import { ASSET_TYPES } from '../../lib/constants/media';
import { LIBRARY_TABS } from '../../lib/constants/library';
import { VOICES, LANGUAGES, engineType, LANGUAGES_PRO } from '../../lib/constants/textToSpeech';
import { addToken, wrapTokens, unwrapTokens } from '../../lib/utils/tokens-helper';

import useUIStore from '../hooks/useUIStore';
import useMediaStore from '../hooks/useMediaStore';
import useProjectStore from '../hooks/useProjectStore';

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

  const [loading, setLoading] = useState(false);
  const [valueTextarea, setValueTextarea] = useState('');
  const [fallbackValue, setFallbackValue] = useState('');
  const [voiceSelect, setVoiceSelect] = useState();
  const [languageSelect, setLanguageSelect] = useState(LANGUAGES[0].value);
  const [selectVoices, setSelectVoices] = useState(VOICES['en-US']);
  const [valueRadio, setValueRadio] = useState(engineType[0].value);
  const [caret, setCaret] = useState();

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

  const backToLibrary = () => {
    setLibraryType(LIBRARY_TABS.VOICE);
  };

  const getVoice = () => {
    setLoading(true);
    postTextToSpeech(
      valueRadio,
      languageSelect,
      isPersonalizeText ? unwrapTokens(valueTextarea) : valueTextarea,
      voiceSelect,
      isPersonalizeText ? ASSET_TYPES.PERSONALIZED_VOICE : ASSET_TYPES.VOICE,
      isPersonalizeText ? fallbackValue : null,
    )
      .then(() => showSuccess(TEXT_TO_SPEECH_SUCCESS.title))
      .catch(() => showError(TEXT_TO_SPEECH_ERROR.title))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const item = LANGUAGES.filter(language => language.value === languageSelect);
    const currentVoice = VOICES[item[0].value];
    if (currentVoice.length) {
      setSelectVoices(currentVoice);
      setVoiceSelect(currentVoice[0].value);
    }
  }, [languageSelect]);

  const itemsRadio = useMemo(() => {
    const modifiedEngineType = engineType.slice();
    // eslint-disable-next-line max-len
    modifiedEngineType[1].disabled = !LANGUAGES_PRO.some(({ value: language }) => language === languageSelect);
    return modifiedEngineType;
  }, [languageSelect]);

  const onVoiceSelect = v => {
    const item = selectVoices.filter(voice => voice.value === v);
    setVoiceSelect(item[0].value);
  };

  const onLanguageSelect = v => {
    const item = LANGUAGES.filter(language => language.value === v);
    setLanguageSelect(item[0].value);
  };

  const onAddTextToken = useCallback((token) => {
    const result = addToken(unwrapTokens(valueTextarea), token, caret);
    setValueTextarea(wrapTokens(result));
  }, [valueTextarea, caret]);

  const handleChange = useCallback((text, data) => {
    setValueTextarea(text);
    setCaret(data.caretOffset);
  }, []);

  const isPersonalizeText = useMemo(() => valueTextarea && unwrapTokens(valueTextarea).indexOf('{{') !== -1, [valueTextarea]);

  const isDisabledButton = useMemo(() => {
    if (isPersonalizeText) {
      return !fallbackValue;
    } else {
      return !valueTextarea;
    }
  }, [valueTextarea, fallbackValue, isPersonalizeText]);

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
              value={languageSelect}
              onChange={onLanguageSelect}
            />
            <FormSelect
              label="Voice"
              items={selectVoices}
              className="text-to-speech__select"
              value={voiceSelect}
              onChange={onVoiceSelect}
            />
            <FormRadioButton
              items={itemsRadio}
              groupName="groupName"
              value={valueRadio}
              containerClassName="text-to-speech__radio-container"
              radioClassName="text-to-speech__radio"
              onChange={setValueRadio}
            />
            <PersonalizeButton onAdd={onAddTextToken} text="Personalize Voice" />
          </div>
          <div className="text-to-speech__right">
            <div className="text-to-speech__text-wrapper">
              {isPersonalizeText && (
                <Fragment>
                  <FormTextArea
                    label="Fallback Value"
                    value={fallbackValue}
                    onChange={setFallbackValue}
                    className="text-to-speech__textarea"
                    inputClassName="text-to-speech__textarea-input"
                    rows={6}
                    text
                  />
                  <p className="text-to-speech__info">Required field</p>
                </Fragment>
              )}
              <p className="text-to-speech__label">Text</p>
              <FormTokensTextArea
                inputClassName="text-to-speech__textarea"
                value={valueTextarea}
                onChange={handleChange}
                additionalFieldName="text"
                caretName="caretOffset"
                variant="multiline"
                updateCaret={(value) => setCaret(value.caretOffset)}
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
      </div>
      <CloseButton onClick={() => toggleRightBlock(false)} />
    </div>
  );
});

export default TextToSpeech;
