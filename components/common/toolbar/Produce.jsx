import React from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';

import useUIStore from '../../hooks/useUIStore';

import AnimatedWindow from '../AnimatedWindow';
import CloseButton from '../CloseButton';

const Produce = observer(({ items, options: { tab, ...options } = {} }) => {
  const defaultTab = tab || items[0].id;
  const [activeTab, setActiveTab] = React.useState(defaultTab);

  const {
    radioButtonBottom,
    checkboxLeft,
    toggleLeftBlock,
    toggleIsExpand,
  } = useUIStore();

  const activeTabItem = items.find(i => i.id === activeTab);
  const { renderer: Panel, items: panelItems = [] } = activeTabItem;

  if (!radioButtonBottom) {
    return null;
  }

  const onClose = () => {
    toggleLeftBlock(false);
    toggleIsExpand();
  };

  return (
    <AnimatedWindow isOpen={checkboxLeft}>
      <div className="produce">
        <div className="produce__tabs">
          {items.map(({ label, id }) => (
            <button
              key={label}
              onClick={() => setActiveTab(id)}
              type="button"
              className={classnames(
                'produce__tab',
                { 'produce__tab-active': activeTabItem && activeTabItem.id === id },
              )}
            >
              <span className="toolbar__tab-title">{label}</span>
            </button>
          ))}
        </div>
        <Panel
          items={panelItems}
          setActiveTab={setActiveTab}
          tab={items[1].id}
          options={options}
        />

        <CloseButton onClick={onClose} />
      </div>
    </AnimatedWindow>
  );
});

Produce.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    label: PropTypes.string,
    icon: PropTypes.string,
    items: PropTypes.arrayOf(PropTypes.shape({
      action: PropTypes.func,
      label: PropTypes.string,
      icon: PropTypes.string,
    })),
    renderer: PropTypes.oneOfType([
      PropTypes.shape({}),
      PropTypes.func,
    ]).isRequired,
  })).isRequired,
  options: PropTypes.shape({
    tab: PropTypes.string,
    focusTitle: PropTypes.bool,
  }),
};

export default Produce;
