import React from 'react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';

const Produce = ({ items, options: { tab, ...options } = {} }) => {
  const defaultTab = tab || items[0].id;
  const [activeTab, setActiveTab] = React.useState(defaultTab);

  const activeTabItem = items.find(i => i.id === activeTab);
  const { renderer: Panel, items: panelItems = [] } = activeTabItem;

  return (
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
    </div>
  );
};

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
