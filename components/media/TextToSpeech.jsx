import React, { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import AudioPlayer from 'react-audio-player';

import { ERROR_TEXT_SYMBOLS } from '../../lib/constants/text-info';
import { ASSET_TYPES } from '../../lib/constants/media';
import {
  VOICES as UNLIMITED_VOICES,
  LANGUAGES as UNLIMITED_LANGUAGES,
  engineType,
  LANGUAGES_PRO,
  LIMITED_VOICES,
  LIMITED_LANGUAGES,
  ENGINE_TYPE_VALUES,
  LANGUAGES_VALUES,
  maxSymbols,
  PREVIEW,
} from '../../lib/constants/textToSpeech';
import { addToken, wrapTokens, unwrapTokens } from '../../lib/utils/tokens-helper';
import { TOKEN_REGEX, tokenModes } from '../../lib/constants/tokens';

import useUIStore from '../hooks/useUIStore';
import useMediaStore from '../hooks/useMediaStore';
import useUserStore from '../hooks/useUserStore';
import useProjectStore from '../hooks/useProjectStore';

import FormSelect from '../form/FormSelect';
import { showError } from '../../lib/services/alertService';
import CloseButton from '../common/CloseButton';
import { LibrarySpinner } from './Loader';
import PersonalizeButton from '../common/personalization/PersonalizeButton';
import FormTokensTextArea from '../form/FormTokensTextArea';
import FormTextArea from '../form/FormTextArea';
import TextToSpeechLibrary from '../common/textToSpeech/TextToSpeechLibrary';

import playIcon from '../../public/static/svgImages/voice/play-voice.svg';
import saveIcon from '../../public/static/svgImages/voice/save-voice.svg';
import textSpeechIcon from '../../public/static/svgImages/common/textspeech.svg';
import arrowIcon from '../../public/static/svgImages/common/arrow-back.svg';
import { LIBRARY_KEYS } from '../../lib/constants/library';

const TextToSpeech = observer(() => {
  const { voiceTextId, setVoiceTextId, findElement } = useProjectStore();
  const { toggleRightBlock, isTimelineOpen, toggleVisibleCanvas } = useUIStore();
  const { getTemporaryTextToSpeech, saveTemporaryTextToSpeech, saveTextToSpeech } = useMediaStore();
  const {
    getTextSpeechSymbols,
    textToSpeechNeuralEnabled,
    onlyLimitedTextToSpeech,
  } = useUserStore();

  const languages = React.useMemo(() => (onlyLimitedTextToSpeech ? LIMITED_LANGUAGES
    : UNLIMITED_LANGUAGES), [onlyLimitedTextToSpeech]);

  const userVoices = React.useMemo(() => (onlyLimitedTextToSpeech ? LIMITED_VOICES
    : UNLIMITED_VOICES), [onlyLimitedTextToSpeech]);

  const [loading, setLoading] = useState(false);

  const [valueTextarea, setValueTextarea] = useState('');
  const [htmlText, setHtmlText] = useState('');

  const [fallbackValue, setFallbackValue] = useState('');
  const [voice, setVoice] = useState();
  const [language, setLanguage] = useState(languages[0].value);
  const [selectedVoices, setSelectedVoices] = useState(userVoices[LANGUAGES_VALUES.ENUS_STANDART]);
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

  useEffect(() => {
    if (voiceTextId && symbols) {
      const activeTextElement = findElement(voiceTextId);
      const isPersonalizedVoice = activeTextElement.popcornOptions.text && activeTextElement.popcornOptions.text.indexOf('{{') !== -1;
      const maxVoiceSymbols = maxCount(
        isPersonalizedVoice ? maxSymbols.personalized : maxSymbols.text,
      );
      const newTextLength = activeTextElement.popcornOptions.text.replace(/{{\w+}}/g, '').length;
      let newText = activeTextElement.popcornOptions.text;

      if (isPersonalizedVoice) {
        const newString = activeTextElement.popcornOptions.text.replace(TOKEN_REGEX, (match) => {
          match = match.replace(/({{|}})/gm, '');
          let result = '';
          if (match.split(' ').length > 1) {
            // eslint-disable-next-line no-unused-vars
            const [helper, tokenName, ...params] = match.split(' ');
            result += `{{${tokenName}}}`;
          } else {
            result += `{{${match}}}`;
          }
          return result;
        });

        const rawArray = newString.split(' ');
        const textArray = [];

        rawArray.forEach(item => {
          if (item.indexOf('{{') !== -1 || item.indexOf('}}') !== -1) {
            const arrayStings = item.replace(TOKEN_REGEX, (match) => {
              match = match.replace(/({{|}})/gm, '');
              let result = '';
              result += ` {{${match}}} `;
              return result;
            }).split(' ');

            arrayStings.forEach(el => {
              if (el) {
                textArray.push(el);
              }
            });
          } else {
            textArray.push(item);
          }
        });

        let lastItemIndex = 0;
        let mapTextLength = 0;
        let difference = 0;
        for (let i = 0; i < textArray.length; i++) {
          if (textArray[i].indexOf('{{') === -1) {
            mapTextLength += textArray[i].length + 1;
            lastItemIndex = i;
          } else {
            mapTextLength += 1;
          }
          if (mapTextLength >= maxVoiceSymbols) {
            difference = mapTextLength - maxVoiceSymbols;
            break;
          }
        }

        textArray[lastItemIndex] = textArray[lastItemIndex].slice(0,
          textArray[lastItemIndex].length - difference);

        if (newTextLength > maxVoiceSymbols) {
          const newArray = textArray.slice(0, lastItemIndex + 1);
          newText = newArray.join(' ');
        } else {
          newText = textArray.join(' ');
        }

        const isBracketsStart = newText.lastIndexOf('{{');
        const isBracketsEnd = newText.lastIndexOf('}}');
        if (isPersonalizedVoice && isBracketsStart > isBracketsEnd) {
          newText = newText.slice(0, isBracketsStart - 1);
        }
      }

      if (newTextLength > maxVoiceSymbols && !isPersonalizedVoice) {
        newText = newText.slice(0, maxVoiceSymbols);
      }

      setValueTextarea(newText);
      setHtmlText(wrapTokens(newText));
      setVoiceTextId(null);
    }
  }, [voiceTextId, symbols]);

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
          text: valueTextarea,
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

  const currentVoiceArray = (lan, currentVoiceType) => {
    const isLanguageWithPro = LANGUAGES_PRO.some(item => item.value === lan);
    if (isLanguageWithPro) {
      return userVoices[`${lan}-${currentVoiceType}`];
    } else {
      return userVoices[lan];
    }
  };

  useEffect(() => {
    const item = languages.find(languageItem => languageItem.value === language).value;
    const currentVoiceType = voiceType || ENGINE_TYPE_VALUES.STANDART;
    currentVoiceArray(item, currentVoiceType);
    const currentVoice = currentVoiceArray(item, currentVoiceType);

    if (currentVoice) {
      setSelectedVoices(currentVoice);
      setVoiceType(ENGINE_TYPE_VALUES.STANDART);
      setVoice(currentVoice[0].value);
      setPreviewUrl(PREVIEW[language][currentVoice[0].value][ENGINE_TYPE_VALUES.STANDART]);
    }
  }, [language]);

  useEffect(() => {
    const item = languages.find(languageItem => languageItem.value === language).value;
    const currentVoiceType = voiceType || ENGINE_TYPE_VALUES.STANDART;
    const currentVoice = currentVoiceArray(item, currentVoiceType);

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
  }, [voiceType, language, voice, valueTextarea, fallbackValue]);

  useEffect(() => playVoice(), [audio]);

  const onLanguageSelect = value => {
    const item = languages.find(languageItem => languageItem.value === value).value;
    setLanguage(item);
    const currentVoice = currentVoiceArray(item, voiceType);

    changeAndPlay(item, currentVoice[0].value, ENGINE_TYPE_VALUES.STANDART);
  };

  const onRadioSelect = () => {
    const voiceEngine = voiceType === ENGINE_TYPE_VALUES.STANDART
      ? ENGINE_TYPE_VALUES.NEURAL : ENGINE_TYPE_VALUES.STANDART;

    const voices = currentVoiceArray(language, voiceEngine);
    let currentVoice = voices[0].value;
    if (!voices.some(item => item.value === voice)) {
      setVoice(currentVoice);
    } else {
      currentVoice = voice;
    }
    setVoiceType(voiceEngine);
    changeAndPlay(language, currentVoice, voiceEngine);
  };

  const isPersonalizeText = useMemo(() => valueTextarea && valueTextarea.indexOf('{{') !== -1, [valueTextarea]);

  const isDisabledButton = useMemo(() => {
    if (!symbols) {
      return true;
    }

    if (isPersonalizeText) {
      return !fallbackValue;
    } else {
      return !valueTextarea;
    }
  }, [valueTextarea, fallbackValue, isPersonalizeText, symbols]);

  const maxTextSymbols = useMemo(() => {
    const value = isPersonalizeText ? maxSymbols.personalized : maxSymbols.text;
    return maxCount(value);
  }, [symbols, isPersonalizeText]);

  const maxFallbackSymbols = useMemo(() => (
    maxCount(maxSymbols.text)
  ), [symbols]);

  const textValueAreaLength = useMemo(() => (
    getValueLength(htmlText)
  ), [htmlText]);

  const handleChange = useCallback((text, data) => {
    setValueTextarea(data.text);
    setHtmlText(text);
    setCaret(data.caretOffset);
  }, [maxTextSymbols]);

  const handleChangeFallback = useCallback((text) => {
    setFallbackValue(text);
  }, [maxFallbackSymbols]);

  const disabledPersonalizedVoice = useMemo(() => {
    if (!symbols) {
      return true;
    }

    return (
      getValueLength(htmlText) >= maxTextSymbols
      || getValueLength(htmlText) >= maxSymbols.personalized
    );
  }, [htmlText, symbols, maxTextSymbols]);

  const onAddTextToken = useCallback((token) => {
    if (disabledPersonalizedVoice) {
      return;
    }
    const result = addToken(valueTextarea, token, caret);
    setValueTextarea(result);
    setHtmlText(wrapTokens(result));
  }, [valueTextarea, caret, maxTextSymbols]);

  const closeWindow = () => {
    toggleRightBlock(false);
    toggleVisibleCanvas(true);
  };

  const disabledProButton = useMemo(() => (
    !(LANGUAGES_PRO.some(({ value }) => value === language))
  ), [language]);

  const currentVoiceImage = useMemo(() => {
    const currentVoices = currentVoiceArray(language, voiceType);
    const currentVoice = currentVoices.find(item => item.value === voice);
    if (currentVoice) {
      return currentVoice.img;
    }
  }, [language, voice]);

  const sliderClick = (direction) => {
    const currentVoices = currentVoiceArray(language, voiceType);
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

  const warningMessage = useMemo(() => {
    if (!symbols) {
      return 'You have reached the maximum number of characters.';
    }
    if (getValueLength(htmlText) >= maxTextSymbols) {
      if (isPersonalizeText) {
        return 'You have reached the maximum number of characters for Personalization. You can personalize this voice up to 70 characters.';
      }
      return 'You\'ve reached the maximum number of characters. You are allowed up to 150 characters for each voice scene.';
    }
    return null;
  }, [maxTextSymbols, htmlText, isPersonalizeText, symbols]);

  return (
    <div className={classnames('text-to-speech', { 'big-window': !isTimelineOpen })}>
      <div className="text-to-speech__title-wrapper">
        <span className="text-to-speech__title">TEXT TO SPEECH</span>
      </div>
      <div className="text-to-speech__body">
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
                items={languages}
                className="text-to-speech__selection"
                selectClassName="text-to-speech__select-list"
                value={language}
                onChange={onLanguageSelect}
              />
              <FormSelect
                label="Voice"
                items={selectedVoices}
                className="text-to-speech__selection"
                selectClassName={classnames('text-to-speech__select-list',
                  { 'text-to-speech__select-voice-list': onlyLimitedTextToSpeech })}
                value={voice}
                onChange={onVoiceSelect}
              />
            </div>
          </div>

          {isPersonalizeText && (
            <Fragment>
              <FormTextArea
                label="Fallback Text"
                value={fallbackValue}
                onChange={handleChangeFallback}
                className="text-to-speech__textarea"
                inputClassName="text-to-speech__textarea-input"
                rows={6}
                text
                maxTextSymbols={maxFallbackSymbols}
              />
              <p className="text-to-speech__info">{`Required field. Enter Fallback Text up to ${maxFallbackSymbols} characters.`}</p>
            </Fragment>
          )}

          <FormTokensTextArea
            label="Text"
            inputClassName="text-to-speech__textarea"
            value={htmlText}
            onChange={handleChange}
            additionalFieldName="text"
            caretName="caretOffset"
            variant="multiline"
            updateCaret={(value) => setCaret(value.caretOffset)}
            maxTextSymbols={maxTextSymbols}
            symbolsCount={textValueAreaLength}
            disabled={!maxTextSymbols}
          />

          <p className="text-to-speech__information">You can use 70 characters to personalize voice or 150 characters for voice without personalization.</p>

          {warningMessage && <p className="text-to-speech__warning">{warningMessage}</p>}

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
                  The number of available characters will decrease each time
                  the video is viewed on playback by individual persons.
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
                className={classnames('btn-speech-get', { 'btn-speech-get-disabled': isDisabledButton || loading })}
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
                  className={classnames('btn-speech-get', { 'btn-speech-get-disabled': loading })}
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
