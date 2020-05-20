import React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';
import useUIStore from '../../hooks/useUIStore';

import arrowIcon from '../../../public/static/svgImages/common/arrow-back.svg';

import AnimatedWindow from '../AnimatedWindow';

const Toolbar = observer(({ items }) => {
  const { toolbarItem: { id, options }, setToolbarItem, isExpand, isTimelineOpen } = useUIStore();

  React.useEffect(() => {
    if (items && items.length && !id) {
      setToolbarItem(items[1].id);
    }
  }, [items]);

  const {
    items: tabContent = [],
    renderer: TabRenderer,
  } = items.find(i => i.id === id) || {};

  const onClick = (label, func) => {
    func();
    setToolbarItem(label);
  };


  return (
    <div className={classnames('toolbar-container', { 'big-window': !isTimelineOpen })}>
      <div className="toolbar-tabs">
        {items.map(({ label, icon, id: tabId, func }) => (
          <button
            className="toolbar-tab"
            key={label}
            onClick={() => onClick(tabId, func)}
            type="button"
          >
            <SVGInline className="toolbar-tab-icon" classSuffix="-inline" svg={icon} cleanup={['title']} />
            <span className="toolbar-tab-title">{label}</span>
            {isExpand && (
              <AnimatedWindow
                isOpen={isExpand}
                style={{ position: 'absolute' }}
              >
                <SVGInline className="toolbar-arrow-icon" svg={arrowIcon} cleanup={['title']} />
              </AnimatedWindow>
            )}
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
