import React, { useEffect, useMemo, useState } from 'react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';
import {
  ENGINE_TYPE_VALUES,
  engineType,
  LANGUAGES,
  LANGUAGES_PRO,
  LANGUAGES_VALUES,
  VOICES,
} from '../../../lib/constants/textToSpeech';

import useUserStore from '../../hooks/useUserStore';

import FormSelect from '../../form/FormSelect';
import FormRadioButton from '../../form/FormRadioButton';

const LibraryVoiceFilter = React.memo((props) => {
  const {
    language,
    setLanguage,
    voice,
    setVoice,
    voiceType,
    setVoiceType,
    fetchItems,
    disabled,
  } = props;

  const [isDisabledInput, setIsDisabledInput] = useState(true);

  const languagesList = [
    { label: 'All', value: null },
    ...LANGUAGES,
  ];

  const [selectedVoices, setSelectedVoices] = useState(VOICES[LANGUAGES_VALUES.ENUS_STANDART]);

  const { textToSpeechNeuralEnabled } = useUserStore();

  const currentVoiceArray = (currentLanguage, currentVoiceType) => {
    const isLanguageWithPro = LANGUAGES_PRO.some(item => item.value === currentLanguage);
    if (isLanguageWithPro) {
      return VOICES[`${currentLanguage}-${currentVoiceType}`];
    } else {
      return VOICES[currentLanguage];
    }
  };

  useEffect(() => {
    const item = languagesList.find(languageItem => languageItem.value === language).value;
    const currentVoiceType = voiceType || ENGINE_TYPE_VALUES.STANDART;
    const currentVoice = currentVoiceArray(item, currentVoiceType);

    if (currentVoice) {
      if (voiceType !== ENGINE_TYPE_VALUES.STANDART) {
        setVoiceType(ENGINE_TYPE_VALUES.STANDART);
      } else {
        setIsDisabledInput(false);
        setSelectedVoices(currentVoice);
        setVoice(currentVoice[0].value);
      }
    } else {
      setVoiceType(null);
      setVoice(null);
      setIsDisabledInput(true);
    }
  }, [language]);

  useEffect(() => {
    const item = languagesList.find(languageItem => languageItem.value === language).value;
    const currentVoiceType = voiceType || ENGINE_TYPE_VALUES.STANDART;
    const currentVoice = currentVoiceArray(item, currentVoiceType);

    if (currentVoice) {
      setIsDisabledInput(false);
      setSelectedVoices(currentVoice);
      setVoice(currentVoice[0].value);
    }
  }, [voiceType]);

  const onLanguageSelect = v => {
    const item = languagesList.find(languageItem => languageItem.value === v).value;
    setLanguage(item);
  };

  const onVoiceSelect = v => {
    const item = selectedVoices.find(voiceItem => voiceItem.value === v).value;
    setVoice(item);
  };

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

  return (
    <div className="library-voice-filter">
      <div className="library-voice-filter__block">
        <div className="library-voice-filter__cell">
          <FormSelect
            label="Language"
            items={languagesList}
            className="text-to-speech__select"
            value={language}
            onChange={onLanguageSelect}
          />
        </div>
        <div className="library-voice-filter__cell">
          <FormSelect
            label="Voice"
            items={selectedVoices}
            className="text-to-speech__select"
            value={voice}
            onChange={onVoiceSelect}
            disabled={isDisabledInput}
          />
        </div>
      </div>

      <div className="library-voice-filter__types">
        {textToSpeechNeuralEnabled && (
          <FormRadioButton
            items={itemsRadio}
            groupName="groupName"
            value={voiceType}
            onChange={setVoiceType}
          />
        )}
      </div>

      <button
        className={classnames('library-voice-filter__btn', { 'library-voice-filter__btn-disabled': disabled })}
        onClick={fetchItems}
        disabled={disabled}
      >
        Filter
      </button>
    </div>
  );
});

LibraryVoiceFilter.propTypes = {
  language: PropTypes.string,
  voice: PropTypes.string,
  voiceType: PropTypes.string,
  setLanguage: PropTypes.func.isRequired,
  setVoice: PropTypes.func.isRequired,
  setVoiceType: PropTypes.func.isRequired,
  fetchItems: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default LibraryVoiceFilter;
