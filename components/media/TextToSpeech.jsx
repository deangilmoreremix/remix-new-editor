import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import { TEXT_TO_SPEECH_SUCCESS, TEXT_TO_SPEECH_ERROR } from '../../lib/constants/text-info';
import { ASSET_TYPES } from '../../lib/constants/media';
import { LIBRARY_TABS } from '../../lib/constants/library';
import { VOICES, LANGUAGES, engineType } from '../../lib/constants/textToSpeech';

import useUIStore from '../hooks/useUIStore';
import useMediaStore from '../hooks/useMediaStore';
import useProjectStore from '../hooks/useProjectStore';

import FormTextArea from '../form/FormTextArea';
import FormSelect from '../form/FormSelect';
import FormRadioButton from '../form/FormRadioButton';
import { showError } from '../../lib/services/alertService';
import CloseButton from '../common/CloseButton';
import { LibrarySpinner } from './Loader';
// import SVGInline from 'react-svg-inline';
// import trashIcon from '../../public/static/svgImages/common/trash.svg';
// import svgVoice from '../../public/static/svgImages/common/voice.svg';
// import FormTextField from '../form/FormTextField';

const TextToSpeech = observer(() => {
  const { toggleRightBlock, isTimelineOpen, setLibraryType } = useUIStore();
  const { postTextToSpeech } = useMediaStore();
  const { showSuccess } = useProjectStore();

  const [loading, setLoading] = useState(false);
  const [valueTextarea, setValueTextarea] = useState(null);
  const [voiceSelect, setVoiceSelect] = useState();
  const [languageSelect, setLanguageSelect] = useState(LANGUAGES[0].value);
  const [selectVoices, setSelectVoices] = useState(VOICES['en-US']);
  const [valueRadio, setValueRadio] = useState(engineType[0].value);

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
      valueTextarea,
      voiceSelect,
      ASSET_TYPES.VOICE,
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

  const onVoiceSelect = v => {
    const item = selectVoices.filter(voice => voice.value === v);
    setVoiceSelect(item[0].value);
  };

  const onLanguageSelect = v => {
    const item = LANGUAGES.filter(language => language.value === v);
    setLanguageSelect(item[0].value);
  };

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
              items={engineType}
              groupName="groupName"
              value={valueRadio}
              containerClassName="text-to-speech__radio-container"
              radioClassName="text-to-speech__radio"
              onChange={setValueRadio}
            />
            <button className="btn-custom">Personalize Voice</button>
          </div>
          <div className="text-to-speech__right">
            <div className="text-to-speech__text-wrapper">
              <FormTextArea
                label="Text"
                text
                value={valueTextarea}
                onChange={setValueTextarea}
                rows={6}
              />
            </div>
            <div className="text-to-speech__loader-btn-group-wrapper">
              <div className="text-to-speech__loader" />
              <div className="text-to-speech__btn-group">
                <button
                  onClick={getVoice}
                  className={classnames('btn-custom btn-speech-get', { 'btn-custom-disabled': !valueTextarea || loading })}
                  disabled={!valueTextarea}
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
