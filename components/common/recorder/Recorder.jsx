import * as React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

import useModalStore from '../../hooks/useModalStore';
import recorderItemsGenerator from '../../../lib/generators/recorderItemsGenerator';

export default observer(() => {
  const { openModal, closeModal } = useModalStore();

  const recorderItems = React.useMemo(() => {
    const items = recorderItemsGenerator({
      actions: {
        openModal,
        closeModal,
      },
    });
    return items && items.length ? items : [];
  }, [
    openModal,
    closeModal,
  ]);

  return (
    <div className="recorder">
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
      </div>
    </div>
  );
});
