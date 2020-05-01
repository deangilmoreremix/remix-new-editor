import React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';
import useUIStore from '../../hooks/useUIStore';

const Toolbar = observer(({ items }) => {
  const { toolbarItem: { id, options }, setToolbarItem } = useUIStore();

  React.useEffect(() => {
    if (items && items.length && !id) {
      setToolbarItem(items[1].id);
    }
  }, [items]);

  const {
    items: tabContent = [],
    renderer: TabRenderer,
    func,
  } = items.find(i => i.id === id) || {};
  const onClick = (label) => {
    setToolbarItem(label);
  };
  React.useEffect(() => {
    if (func) {
      func();
    }
  }, [id]);

  return (
    <div className="toolbar-container">
      <div className="toolbar-tabs">
        {items.map(({ label, icon, id: tabId }) => (
          <button
            className="toolbar-tab"
            key={label}
            onClick={() => onClick(tabId)}
            type="button"
          >
            <SVGInline className="toolbar-tab-icon" classSuffix="-inline" svg={icon} cleanup={['title']} />
            <span className="toolbar-tab-title">{label}</span>
          </button>
        ))}
      </div>
      {TabRenderer && <TabRenderer items={tabContent} options={options} />}
    </div>
  );
});

Toolbar.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.string.isRequired,
    items: PropTypes.arrayOf(PropTypes.shape({
      action: PropTypes.func,
      label: PropTypes.string.isRequired,
      icon: PropTypes.string,
    })),
    renderer: PropTypes.func,
    func: PropTypes.func,
  })).isRequired,
};

export default Toolbar;
