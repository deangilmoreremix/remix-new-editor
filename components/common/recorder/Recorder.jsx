import React, { useState, useMemo } from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

import { editorStyles } from '../../../lib/constants/editorStyles';

import useModalStore from '../../hooks/useModalStore';
import useUIStore from '../../hooks/useUIStore';
import useTimelineStore from '../../hooks/useTimelineStore';

import recorderItemsGenerator from '../../../lib/generators/recorderItemsGenerator';
import CloseButton from '../CloseButton';
import Toggler from '../../form/Toggler';

export default observer(() => {
  const [useAudio, setUseAudio] = useState(true);

  const { openModal, closeModal } = useModalStore();
  const { toggleRightBlock } = useUIStore();
  const { timelineHeight } = useTimelineStore();

  const recorderItems = useMemo(() => {
    const items = recorderItemsGenerator({
      actions: {
        openModal,
        closeModal,
      },
      useAudio,
    });
    return items && items.length ? items : [];
  }, [
    openModal,
    closeModal,
    useAudio,
  ]);

  const libraryHeight = useMemo(() => (
    editorStyles.calculateHeight(timelineHeight)
  ), [timelineHeight]);

  return (
    <div style={{ height: libraryHeight }} className="recorder">
      <div className="flex">
        <div className="recorder__header">
          <span>Recorder</span>
        </div>
        <CloseButton onClick={() => toggleRightBlock(false)} />
      </div>
      <div className="recorder__body">
        <div className="recorder-panel">
          {recorderItems.map(({ label, action, id, icon }) => (
            <button
              className="recorder-panel__button"
              type="button"
              key={id}
              onClick={action}
            >
              <SVGInline
                className="recorder-panel__icon"
                svg={icon}
                cleanup={['title']}
              />
              {label}
            </button>
          ))}
          <div className="mute-btn">
            <Toggler
              onChange={() => setUseAudio(!useAudio)}
              checked={useAudio}
              label="Microphone"
            />
          </div>
       
        </div>
      </div>
    </div>
  );
});
