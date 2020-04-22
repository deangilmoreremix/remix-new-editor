import React from 'react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';

const Produce = ({ items }) => {
  const [activeTab, setActiveTab] = React.useState(items[0].label);

  const activeTabItem = items.find(i => i.label === activeTab);
  const { renderer: Panel, items: panelItems = [] } = activeTabItem;

  return (
    <div className="produce">
      <div className="produce__tabs">
        {items.map(({ label }) => (
          <button
            key={label}
            onClick={() => setActiveTab(label)}
            type="button"
            className={classnames(
              'produce__tab',
              { 'produce__tab-active': activeTabItem.label.toLowerCase() === label.toLowerCase() },
            )}
          >
            <span className="toolbar__tab-title">{label}</span>
          </button>
        ))}
      </div>
      <Panel
        items={panelItems}
        setActiveTab={setActiveTab}
        tabs={items}
      />
    </div>
  );
};

Produce.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string,
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
};

export default Produce;
