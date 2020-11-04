import React, { useMemo, Fragment } from 'react';
import { useRouter } from 'next/router';

import preRemixVoice from '../../lib/constants/preRemixVoice';
import { PRE_REMIX_VOICE_MODAL } from '../../lib/constants/modals';

import useModalStore from '../hooks/useModalStore';
import useProjectStore from '../hooks/useProjectStore';

const PreRemixVoiceModal = () => {
  const { query: { remix } } = useRouter();
  const { options: { scenario }, closeModal } = useModalStore();
  const { remixPersonalizedOne, remixOne } = useProjectStore();
  const title = useMemo(() => preRemixVoice[scenario].modalTitle, [scenario]);

  const createNewProject = () => window.open('/');

  const upgradeFn = () => window.open('https://paykickstart.com');

  const withVoiceFn = async () => {
    await remixPersonalizedOne(remix);
    closeModal(PRE_REMIX_VOICE_MODAL);
  };

  const withoutVoiceFn = async () => {
    await remixOne(remix);
    closeModal(PRE_REMIX_VOICE_MODAL);
  };

  const btnNewProject = useMemo(() => (
    <button className="pre-remix-voice__btn" onClick={createNewProject}>
      <span>Create a new project</span>
    </button>
  ), []);

  const btnRemixWithoutVoice = useMemo(() => (
    <button className="pre-remix-voice__btn" onClick={withoutVoiceFn}>
      <span>Create a remix without voices</span>
    </button>
  ), []);

  const btnRemixWithVoice = useMemo(() => {
    if (scenario === preRemixVoice.hasData.name) {
      return (
        <button className="pre-remix-voice__btn" onClick={withVoiceFn}>
          <span>Create a remix with voices</span>
        </button>
      );
    }
    return null;
  }, [scenario]);

  const btnUpgrade = useMemo(() => {
    if (scenario === preRemixVoice.noFeature.name
      || scenario === preRemixVoice.noNeuralFeature.name
      || scenario === preRemixVoice.allowedOnlyBaseTemplates.name) {
      return (
        <button className="pre-remix-voice__btn" onClick={upgradeFn}>
          <span>Go to upgrade</span>
        </button>
      );
    }
    return null;
  }, [scenario]);

  return (
    <Fragment>
      {title && <p className="pre-remix-voice__title">{title}</p>}
      <div className="pre-remix-voice__btns">
        {btnNewProject}
        {btnUpgrade}
        {btnRemixWithoutVoice}
        {btnRemixWithVoice}
      </div>
    </Fragment>
  );
};

export default PreRemixVoiceModal;
