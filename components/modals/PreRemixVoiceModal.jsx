import React, { useMemo, Fragment } from 'react';

import preRemixVoice from '../../lib/constants/preRemixVoice';
import useModalStore from '../hooks/useModalStore';

const PreRemixVoiceModal = () => {
  const { options: { scenario } } = useModalStore();
  const title = useMemo(() => preRemixVoice[scenario].modalTitle, [scenario]);

  const createNewProject = () => window.open('/');

  const btnNewProject = useMemo(() => (
    <button className="pre-remix-voice__btn" onClick={createNewProject}>
      <span>Create a new project</span>
    </button>
  ), []);

  const btnRemixWithoutVoice = useMemo(() => (
    <button className="pre-remix-voice__btn">
      <span>Create a remix without voices</span>
    </button>
  ), []);

  const btnRemixWithVoice = useMemo(() => {
    if (scenario === preRemixVoice.hasData.name) {
      return (
        <button className="pre-remix-voice__btn">
          <span>Create a remix with voices</span>
        </button>
      );
    }
    return null;
  }, [scenario]);

  const btnUpgrade = useMemo(() => {
    if (scenario === preRemixVoice.noFeature.name) {
      return (
        <a href="https://paykickstart.com" className="pre-remix-voice__btn">
          <span>Go to upgrade</span>
        </a>
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
