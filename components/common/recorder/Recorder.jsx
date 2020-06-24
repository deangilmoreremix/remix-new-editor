import * as React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import useModalStore from '../../hooks/useModalStore';
import useUIStore from '../../hooks/useUIStore';

import recorderItemsGenerator from '../../../lib/generators/recorderItemsGenerator';
import CloseButton from '../CloseButton';
import Toggler from '../../form/Toggler';

export default observer(() => {
  const [useAudio, setUseAudio] = React.useState(true);

  const { openModal, closeModal } = useModalStore();
  const { toggleRightBlock, isTimelineOpen } = useUIStore();

  const recorderItems = React.useMemo(() => {
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

  return (
    <div className={classnames('recorder', { 'big-window': !isTimelineOpen })}>
      <div className="recorder__header">
        <span>Recorder</span>
      </div>
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

      <CloseButton onClick={() => toggleRightBlock(false)} />
    </div>
  );
});
