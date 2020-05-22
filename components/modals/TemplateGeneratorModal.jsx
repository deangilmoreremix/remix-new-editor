import React, { useState } from 'react';
import { observer } from 'mobx-react';

import { showSuccess, showError } from '../../lib/services/alertService';
import { InitialModalContent, MediaModalContent } from './TemplateGenerator';
import { NICHE_SCRIPTS_MODAL } from '../../lib/constants/modals';
import useModalStore from '../hooks/useModalStore';
import useProjectStore from '../hooks/useProjectStore';

const modalContents = {
  INITIAL: 'INITIAL',
  MEDIA: 'MEDIA',
  NICHE_SCRIPTS: 'NICHE_SCRIPTS',
};

const TemplateGeneratorModal = observer(({ handleClose, setHeader, setClassName }) => {
  const [content, setContent] = useState(modalContents.INITIAL);
  const [chosenVideo, setChosenVideo] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const { openModal, closeModal } = useModalStore();
  const { fromTemplate } = useProjectStore();

  const finish = React.useCallback(async (script, video) => {
    setIsLoading(true);
    try {
      await fromTemplate(script, video.url, true);
      closeModal(NICHE_SCRIPTS_MODAL);
      showSuccess(`Video ${chosenVideo.title} and script ${script.title} were chosen`);
    } catch (e) {
      showError(e.message);
      setIsLoading(false);
      closeModal(NICHE_SCRIPTS_MODAL);
      setContent(modalContents.MEDIA);
    }
    setTimeout(handleClose, 500);
  }, [closeModal, fromTemplate, handleClose]);

  const getComponent = React.useMemo(() => {
    switch (content) {
      case modalContents.INITIAL:
        return (
          <InitialModalContent
            accept={() => { setContent(modalContents.MEDIA); setClassName('template-generator-modal max-size'); }}
            decline={handleClose}
          />
        );
      case modalContents.MEDIA:
        return (
          <MediaModalContent
            useVideo={(video) => {
              setChosenVideo(video);
              openModal(NICHE_SCRIPTS_MODAL, { onSelect: (script) => finish(script, video) });
            }}
            setHeader={setHeader}
          />
        );
      default:
        throw new Error(`Unsupported modal content type ${content}`);
    }
  }, [content, finish, handleClose, openModal, setClassName, setHeader]);

  return (
    <div className="template-generator-modal-content">
      {isLoading ? <div>Loading</div> : getComponent}
    </div>
  );
});

export default TemplateGeneratorModal;
