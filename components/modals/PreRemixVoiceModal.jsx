import React, { useMemo, Fragment, useState } from 'react';
import { observer } from 'mobx-react';
import { useRouter } from 'next/router';

import preRemixVoice from '../../lib/constants/preRemixVoice';
import { PRE_REMIX_VOICE_MODAL } from '../../lib/constants/modals';

import useModalStore from '../hooks/useModalStore';
import useProjectStore from '../hooks/useProjectStore';

import { LibrarySpinner } from '../media/Loader';

const PreRemixVoiceModal = observer(() => {
  const [isLoading, setIsloading] = useState(false);

  const router = useRouter();
  const { query: { remix } } = router;
  const { options: { scenario }, closeModal } = useModalStore();
  const { remixPersonalizedOne, remixOne, setIsRedirect } = useProjectStore();

  const title = useMemo(() => preRemixVoice[scenario]?.modalTitle, [scenario]);

  const createNewProject = () => {
    router.push('/');
    closeModal(PRE_REMIX_VOICE_MODAL);
    setIsRedirect(true);
  };

  // const upgradeFn = () => window.open('https://paykickstart.com');

  const withVoiceFn = async () => {
    setIsloading(true);
    await remixPersonalizedOne(remix);
    closeModal(PRE_REMIX_VOICE_MODAL);
  };

  const withoutVoiceFn = async () => {
    setIsloading(true);
    await remixOne(remix, true);
    closeModal(PRE_REMIX_VOICE_MODAL);
  };

  const btnNewProject = useMemo(() => (
    <button className="pre-remix-voice__btn" onClick={createNewProject}>
      <span>Create a new project</span>
    </button>
  ), []);

  const btnRemixWithoutVoice = useMemo(() => (
    <button
      className="pre-remix-voice__btn"
      onClick={withoutVoiceFn}
      disabled={isLoading}
    >
      <span>Create a remix without voices</span>
    </button>
  ), []);

  const btnRemixWithVoice = useMemo(() => {
    if (scenario === preRemixVoice.hasData.name) {
      return (
        <button
          className="pre-remix-voice__btn"
          onClick={withVoiceFn}
          disabled={isLoading}
        >
          <span>Create a remix with voices</span>
        </button>
      );
    }
    return null;
  }, [scenario]);

  // const btnUpgrade = useMemo(() => {
  //   if (scenario === preRemixVoice.noFeature.name
  //     || scenario === preRemixVoice.noNeuralFeature.name
  //     || scenario === preRemixVoice.allowedOnlyBaseTemplates.name) {
  //     return (
  //       <button className="pre-remix-voice__btn" onClick={upgradeFn}>
  //         <span>Go to upgrade</span>
  //       </button>
  //     );
  //   }
  //   return null;
  // }, [scenario]);

  return (
    <Fragment>
      {title && <p className="pre-remix-voice__title">{title}</p>}
      {isLoading ? <div className="pre-remix-voice__loader"><LibrarySpinner /></div> : (
        <div className="pre-remix-voice__btns">
          {btnNewProject}
          {btnRemixWithoutVoice}
          {btnRemixWithVoice}
        </div>
      )}
    </Fragment>
  );
});

export default PreRemixVoiceModal;
