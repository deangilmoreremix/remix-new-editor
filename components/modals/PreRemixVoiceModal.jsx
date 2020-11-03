import React, { useMemo, Fragment } from 'react';

import preRemixVoice from '../../lib/constants/preRemixVoice';
import useModalStore from '../hooks/useModalStore';

const PreRemixVoiceModal = () => {
  const { options: { scenario } } = useModalStore();
  const title = useMemo(() => preRemixVoice[scenario].modalTitle, [scenario]);

  const createNewProject = () => window.open('/');

  const btnNewProject = useMemo(() => (
    <button className="pre-remix-voice__btn" onClick={createNewProject}>Create new project</button>
  ), []);

  const btnRemixWithoutVoice = useMemo(() => (
    <button className="pre-remix-voice__btn">Create a remix without voices</button>
  ), []);

  const btnRemixWithVoice = useMemo(() => {
    if (scenario === preRemixVoice.hasData.name) {
      return <button className="pre-remix-voice__btn">Create a remix with voices</button>;
    }
    return null;
  }, [scenario]);

  const btnUpgrade = useMemo(() => {
    if (scenario === preRemixVoice.noFeature.name) {
      return (
        <a href="https://paykickstart.com" className="pre-remix-voice__btn">Go to upgrade</a>
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
