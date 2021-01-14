import React, { useEffect, useMemo, useState } from 'react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';
import {
  ENGINE_TYPE_VALUES,
  engineType,
  LANGUAGES,
  LANGUAGES_VALUES,
  VOICES,
} from '../../../lib/constants/googleTextToSpeech';

import useUserStore from '../../hooks/useUserStore';

import FormSelect from '../../form/FormSelect';
import FormRadioButton from '../../form/FormRadioButton';

const languagesList = [
  { label: 'All', value: null },
  ...LANGUAGES,
];

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

  const [selectedVoices, setSelectedVoices] = useState(VOICES[LANGUAGES_VALUES.EN_US]);

  const { textToSpeechNeuralEnabled } = useUserStore();

  const currentVoices = React.useMemo(() => VOICES[language] || [], [language]);

  React.useEffect(() => {
    if (voice && voice.value) {
      const disabledPro = !voice.pro;
      const disabledStandard = !voice.standard;
      let newVoiceType = voiceType || ENGINE_TYPE_VALUES.NEURAL;
      if (disabledPro && newVoiceType === ENGINE_TYPE_VALUES.NEURAL) {
        newVoiceType = ENGINE_TYPE_VALUES.STANDART;
      } else if (disabledStandard && newVoiceType === ENGINE_TYPE_VALUES.STANDART) {
        newVoiceType = ENGINE_TYPE_VALUES.NEURAL;
      }
      setVoiceType(newVoiceType);
    }
  }, [voice?.value]);

  useEffect(() => {
    if (currentVoices.length) {
      setIsDisabledInput(false);
      setSelectedVoices(currentVoices);
      setVoice(currentVoices[0]);
    } else {
      setVoiceType(null);
      setVoice(null);
      setIsDisabledInput(true);
    }
  }, [currentVoices]);

  const onLanguageSelect = v => {
    const item = languagesList.find(languageItem => languageItem.value === v).value;
    setLanguage(item);
  };

  const onVoiceSelect = v => {
    const item = selectedVoices.find(voiceItem => voiceItem.value === v);
    setVoice(item);
  };

  const itemsRadio = useMemo(() => {
    const modifiedEngineType = engineType.slice();
    if (language) {
      modifiedEngineType.forEach(item => {
        item.disabled = false;
      });
      modifiedEngineType[1].disabled = !voice.pro;
      modifiedEngineType[0].disabled = !voice.standard;
    } else {
      modifiedEngineType.forEach(item => {
        item.disabled = true;
      });
    }

    return modifiedEngineType;
  }, [language, voice?.value]);

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
            value={voice.value}
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
  voice: PropTypes.shape({
    standard: PropTypes.string,
    pro: PropTypes.string,
    value: PropTypes.string,
  }).isRequired,
  voiceType: PropTypes.string,
  setLanguage: PropTypes.func.isRequired,
  setVoice: PropTypes.func.isRequired,
  setVoiceType: PropTypes.func.isRequired,
  fetchItems: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default LibraryVoiceFilter;
