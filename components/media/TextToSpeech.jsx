import React, { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import AudioPlayer from 'react-audio-player';

import { ERROR_TEXT_SYMBOLS } from '../../lib/constants/text-info';
import { ASSET_TYPES } from '../../lib/constants/media';
import {
  VOICES,
  LANGUAGES,
  engineType,
  LANGUAGES_PRO,
  ENGINE_TYPE_VALUES,
  LANGUAGES_VALUES,
  DEFAULT_VOICES,
  maxSymbols,
  PREVIEW,
  VOICES_PRO,
} from '../../lib/constants/textToSpeech';
import { addToken, wrapTokens, unwrapTokens } from '../../lib/utils/tokens-helper';
import { tokenModes } from '../../lib/constants/tokens';
import { VALIDATION_ENG_LANGUAGE } from '../../lib/constants/regExps';

import useUIStore from '../hooks/useUIStore';
import useMediaStore from '../hooks/useMediaStore';
import useUserStore from '../hooks/useUserStore';

import FormSelect from '../form/FormSelect';
import { showError } from '../../lib/services/alertService';
import CloseButton from '../common/CloseButton';
import { LibrarySpinner } from './Loader';
import PersonalizeButton from '../common/personalization/PersonalizeButton';
import FormTokensTextArea from '../form/FormTokensTextArea';
import FormTextArea from '../form/FormTextArea';
import TextToSpeechLibrary from '../common/textToSpeech/TextToSpeechLibrary';

import playIcon from '../../public/static/svgImages/common/play.svg';
// todo update icon
import saveIcon from '../../public/static/svgImages/header/save.svg';
import textSpeechIcon from '../../public/static/svgImages/common/textspeech.svg';
import arrowIcon from '../../public/static/svgImages/common/arrow-back.svg';
import { LIBRARY_KEYS } from '../../lib/constants/library';

const TextToSpeech = observer(() => {
  const { toggleRightBlock, isTimelineOpen, toggleVisibleCanvas } = useUIStore();
  const { getTemporaryTextToSpeech, saveTemporaryTextToSpeech, saveTextToSpeech } = useMediaStore();
  const { getTextSpeechSymbols, textToSpeechNeuralEnabled } = useUserStore();

  const [loading, setLoading] = useState(false);
  const [valueTextarea, setValueTextarea] = useState('');
  const [fallbackValue, setFallbackValue] = useState('');
  const [voice, setVoice] = useState();
  const [language, setLanguage] = useState(LANGUAGES[0].value);
  const [selectedVoices, setSelectedVoices] = useState(VOICES[LANGUAGES_VALUES.ENUS_STANDART]);
  const [voiceType, setVoiceType] = useState(engineType[0].value);
  const [caret, setCaret] = useState();
  const [symbols, setSymbols] = useState();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isActivePreview, setIsActivePreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDisplayingControls, setIsDisplayingControls] = useState(true);
  const [audioFile, setAudioFile] = useState(null);
  const [audio, setAudio] = useState(null);
  const [addedItems, setAddedItems] = useState([]);

  const changePlaying = () => {
    setIsPlaying(value => {
      setIsActivePreview(!value);
      return !value;
    });
  };

  const existedAudio = useMemo(() => !!audio, [audio]);

  const existedAudioFile = useMemo(() => !!audioFile, [audioFile]);

  const lastKind = useMemo(() => {
    if (addedItems.length) {
      const lastElement = addedItems[0];
      return lastElement.kind === ASSET_TYPES.VOICE
        ? LIBRARY_KEYS.VOICE : LIBRARY_KEYS.PERSONALIZED_VOICE;
    }
    return null;
  }, [addedItems]);

  const changeAndPlay = (languageItem, voiceItem, voiceTypeItem) => {
    const url = PREVIEW[languageItem][voiceItem][voiceTypeItem];
    setPreviewUrl(url);
    if (url) {
      setIsActivePreview(true);
      setIsPlaying(true);
      if (!isDisplayingControls) {
        setIsDisplayingControls(true);
      }
    } else {
      setIsDisplayingControls(false);
    }
  };

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

  const playVoice = React.useCallback(() => {
    if (audio) {
      const promise = audio.play();
      if (promise) {
        promise.catch(() => {
          showError('To play audio please press play again');
        });
      }
    }
  }, [audio]);

  const getVoice = () => {
    setLoading(true);
    getTemporaryTextToSpeech({
      engine: voiceType,
      language,
      text: isPersonalizeText ? fallbackValue : valueTextarea,
      voice,
    },
    )
      .then((result) => {
        setAudioFile(result.blob);
        setAudio(result.audio);
      })
      .catch((e) => showError((e && e.message) || e))
      .finally(() => setLoading(false));
  };

  const saveVoice = () => {
    setLoading(true);
    saveTemporaryTextToSpeech(audioFile)
      .then((result) => {
        setAudioFile(null);
        return saveTextToSpeech({
          engine: voiceType,
          language,
          voice,
          url: result.url,
          text: isPersonalizeText ? unwrapTokens(valueTextarea) : valueTextarea,
          fallbackValue,
          isPersonalizeText,
        });
      })
      .catch((e) => showError((e && (e.message || e.error)) || e))
      .then((result) => {
        if (addedItems.length) {
          return setAddedItems([result, ...addedItems]);
        }
        return setAddedItems([result]);
      })
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
      setSelectedVoices(currentVoice);
      setVoiceType(ENGINE_TYPE_VALUES.STANDART);
      setVoice(currentVoice[0].value);
      setPreviewUrl(PREVIEW[language][currentVoice[0].value][voiceType]);
    }
  }, [language]);

  useEffect(() => {
    const item = LANGUAGES.find(languageItem => languageItem.value === language).value;
    const currentVoiceType = voiceType || ENGINE_TYPE_VALUES.STANDART;
    const currentVoice = item === LANGUAGES_VALUES.ENUS
      ? DEFAULT_VOICES[currentVoiceType] : VOICES[item];

    if (currentVoice) {
      setSelectedVoices(currentVoice);
    }
  }, [voiceType]);

  const onVoiceSelect = value => {
    const item = selectedVoices.find(voiceItem => voiceItem.value === value).value;
    setVoice(item);
    changeAndPlay(language, item, voiceType);
  };

  useEffect(() => {
    setAudioFile(null);
    setAudio(null);
  }, [voiceType, language, voice, valueTextarea]);

  useEffect(() => playVoice(), [audio]);

  const onLanguageSelect = value => {
    const item = LANGUAGES.find(languageItem => languageItem.value === value).value;
    setLanguage(item);
    const currentVoice = item === LANGUAGES_VALUES.ENUS
      ? DEFAULT_VOICES[voiceType] : VOICES[item];
    changeAndPlay(item, currentVoice[0].value, ENGINE_TYPE_VALUES.STANDART);
  };

  const onRadioSelect = () => {
    const voiceEngine = voiceType === ENGINE_TYPE_VALUES.STANDART
      ? ENGINE_TYPE_VALUES.NEURAL : ENGINE_TYPE_VALUES.STANDART;

    const voices = language === LANGUAGES_VALUES.ENUS
      ? DEFAULT_VOICES[voiceType] : VOICES[language];
    let currentVoice = voices[0].value;
    if (voiceEngine === ENGINE_TYPE_VALUES.STANDART && voice === VOICES_PRO[0].value) {
      setVoice(currentVoice);
    } else {
      currentVoice = voice;
    }
    setVoiceType(voiceEngine);
    changeAndPlay(language, currentVoice, voiceEngine);
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

  const disabledPersonalizedVoice = useMemo(() => {
    if (!symbols) {
      return true;
    }
    return getValueLength(valueTextarea) >= maxSymbols.personalized;
  }, [valueTextarea, symbols]);

  const onAddTextToken = useCallback((token) => {
    if (disabledPersonalizedVoice) {
      return;
    }
    const result = addToken(unwrapTokens(valueTextarea), token, caret);
    setValueTextarea(wrapTokens(result));
  }, [valueTextarea, caret, maxTextSymbols]);

  const closeWindow = () => {
    toggleRightBlock(false);
    toggleVisibleCanvas(true);
  };

  const disabledProButton = useMemo(() => (
    !(LANGUAGES_PRO.some(({ value }) => value === language))
  ), [language]);

  const currentVoiceImage = useMemo(() => {
    const currentVoices = language === LANGUAGES_VALUES.ENUS
      ? DEFAULT_VOICES[voiceType] : VOICES[language];
    const currentVoice = currentVoices.find(item => item.value === voice);
    if (currentVoice) {
      return currentVoice.img;
    }
  }, [language, voice]);

  const sliderClick = (direction) => {
    const currentVoices = language === LANGUAGES_VALUES.ENUS
      ? DEFAULT_VOICES[voiceType] : VOICES[language];
    const currentVoice = currentVoices.find(item => item.value === voice);
    const currentIndex = currentVoices.indexOf(currentVoice);

    let item;
    if (direction === 'left') {
      item = currentIndex === 0
        ? currentVoices[currentVoices.length - 1].value : currentVoices[currentIndex - 1].value;
    } else {
      item = currentIndex === currentVoices.length - 1
        ? currentVoices[0].value : currentVoices[currentIndex + 1].value;
    }
    setVoice(item);
    changeAndPlay(language, item, voiceType);
  };


  return (
    <div className={classnames('text-to-speech', { 'big-window': !isTimelineOpen })}>
      <div className="text-to-speech__title-wrapper">
        <span className="text-to-speech__title">TEXT TO SPEECH</span>
      </div>
      <div className="text-to-speech__body">
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
        <div className="text-to-speech__creator">
          <div className="text-to-speech__control">
            {textToSpeechNeuralEnabled && (
              <button
                onClick={onRadioSelect}
                disabled={disabledProButton}
                className={classnames(
                  'text-to-speech__radio',
                  { 'text-to-speech__radio-active': voiceType === ENGINE_TYPE_VALUES.NEURAL },
                  { 'text-to-speech__radio-disabled': disabledProButton },
                )}
              >
                PRO
              </button>
            )}

            <div className="text-to-speech__clear-block" />

            <div className="text-to-speech__select-block">
              <FormSelect
                label="Language"
                items={LANGUAGES}
                className="text-to-speech__selection"
                selectClassName="text-to-speech__select-list"
                value={language}
                onChange={onLanguageSelect}
              />
              <FormSelect
                label="Voice"
                items={selectedVoices}
                className="text-to-speech__selection"
                selectClassName="text-to-speech__select-list"
                value={voice}
                onChange={onVoiceSelect}
              />
            </div>
          </div>

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
                languageValidator={VALIDATION_ENG_LANGUAGE}
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
            languageValidator={VALIDATION_ENG_LANGUAGE}
          />

          <div className="text-to-speech__footer">
            <div className="text-to-speech__notification">
              {symbols !== undefined && (
                <div className="text-to-speech__notification-top">
                  <p>
                    The number of characters remaining is
                    <span>{` ${symbols.toLocaleString('en')}`}</span>
                    .
                  </p>
                  <div className="text-to-speech__icon">
                    <SVGInline
                      svg={textSpeechIcon}
                      cleanup={['title']}
                    />
                  </div>
                </div>
              )}
              {isPersonalizeText && (
                <p className="text-to-speech__notification-bottom">
                  Each time you watch your video in the player,
                  the number of available symbols will decrease.
                </p>
              )}
            </div>

            <div className="text-to-speech__buttons">
              <PersonalizeButton
                onAdd={onAddTextToken}
                text="Personalize Voice"
                disabled={disabledPersonalizedVoice}
                elementType={ASSET_TYPES.PERSONALIZED_VOICE}
                tokenModes={{
                  plain: tokenModes.plain,
                }}
              />
              <button
                onClick={existedAudio ? playVoice : getVoice}
                className={classnames('btn-speech-get', { 'btn-custom-disabled': isDisabledButton || loading })}
                disabled={isDisabledButton}
              >
                {loading && !existedAudioFile ? <LibrarySpinner /> : (
                  <SVGInline
                    svg={playIcon}
                    cleanup={['title']}
                  />
                )}
              </button>
              {existedAudioFile ? (
                <button
                  onClick={saveVoice}
                  className={classnames('btn-speech-get', { 'btn-custom-disabled': loading })}
                >
                  {loading ? <LibrarySpinner /> : (
                    <SVGInline
                      svg={saveIcon}
                      cleanup={['title']}
                    />
                  )}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className={classnames('text-to-speech__slider', { 'text-to-speech__slider-enum': !textToSpeechNeuralEnabled })}>
          <button className="text-to-speech__slider-left" onClick={() => sliderClick('left')}>
            <SVGInline
              svg={arrowIcon}
              cleanup={['title']}
            />
          </button>
          <button className="text-to-speech__slider-right" onClick={sliderClick}>
            <SVGInline
              svg={arrowIcon}
              cleanup={['title']}
            />
          </button>
          <p className="text-to-speech__voice-name">{voice}</p>
          <div className="text-to-speech__image">
            <img src={currentVoiceImage} alt="img" />
          </div>
          {isDisplayingControls && (
            <div className="text-to-speech__controls">
              <button
                className={classnames('text-to-speech__button', { 'text-to-speech__button-active': isPlaying })}
                onClick={changePlaying}
              />
              {isActivePreview && (
                <AudioPlayer
                  src={previewUrl}
                  onEnded={() => changePlaying(false)}
                  autoPlay
                />
              )}
            </div>
          )}
        </div>

        <TextToSpeechLibrary
          addedItems={addedItems}
          setAddedItems={setAddedItems}
          kind={lastKind}
        />
      </div>
      <CloseButton onClick={closeWindow} />
    </div>
  );
});

export default TextToSpeech;
