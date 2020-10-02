import React, { useEffect, useMemo, useState } from 'react';

import PropTypes from '../../../lib/PropTypes';
import {
  ENGINE_TYPE_VALUES,
  engineType,
  LANGUAGES,
  LANGUAGES_PRO,
  LANGUAGES_VALUES,
  VOICES,
  DEFAULT_VOICES,
} from '../../../lib/constants/textToSpeech';

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
  } = props;

  const [isDisabledInput, setIsDisabledInput] = useState(true);

  const languagesList = [
    { label: 'All', value: null },
    ...LANGUAGES,
  ];

  const [selectVoices, setSelectVoices] = useState(VOICES[LANGUAGES_VALUES.ENUS_STANDART]);

  useEffect(() => {
    const item = languagesList.find(languageItem => languageItem.value === language).value;
    const currentVoiceType = voiceType || ENGINE_TYPE_VALUES.STANDART;
    const currentVoice = item === LANGUAGES_VALUES.ENUS
      ? DEFAULT_VOICES[currentVoiceType] : VOICES[item];

    if (currentVoice) {
      setVoiceType(ENGINE_TYPE_VALUES.STANDART);
    } else {
      setVoiceType(null);
      setVoice(null);
      setIsDisabledInput(true);
    }
  }, [language]);

  useEffect(() => {
    const item = languagesList.find(languageItem => languageItem.value === language).value;
    const currentVoiceType = voiceType || ENGINE_TYPE_VALUES.STANDART;
    const currentVoice = item === LANGUAGES_VALUES.ENUS
      ? DEFAULT_VOICES[currentVoiceType] : VOICES[item];

    if (currentVoice) {
      setIsDisabledInput(false);
      setSelectVoices(currentVoice);
      setVoice(currentVoice[0].value);
    }
  }, [voiceType]);

  const onLanguageSelect = v => {
    const item = languagesList.find(languageItem => languageItem.value === v).value;
    setLanguage(item);
  };

  const onVoiceSelect = v => {
    const item = selectVoices.find(voiceItem => voiceItem.value === v).value;
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
            items={selectVoices}
            className="text-to-speech__select"
            value={voice}
            onChange={onVoiceSelect}
            disabled={isDisabledInput}
          />
        </div>
      </div>

      <div className="library-voice-filter__types">
        <FormRadioButton
          items={itemsRadio}
          groupName="groupName"
          value={voiceType}
          onChange={setVoiceType}
        />
      </div>

      <button className="library-voice-filter__btn" onClick={fetchItems}>Filter</button>
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
};

export default LibraryVoiceFilter;
