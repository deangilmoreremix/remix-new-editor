import React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';
import useUIStore from '../../hooks/useUIStore';

import arrowIcon from '../../../public/static/svgImages/common/arrow-back.svg';
import { WINDOW_TYPES } from '../../../lib/constants/ui';

import AnimatedWindow from '../AnimatedWindow';
import HelpIconComponent from '../HelpIcon';

const Toolbar = observer(({ items }) => {
  let tooltipTime;

  const {
    toolbarItem: {
      id,
      options,
    },
    setToolbarItem,
    isExpand,
    isTimelineOpen,
    toggleVisibleCanvas,
    isCanvasPresent,
    secondaryWindowType,
  } = useUIStore();

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
    if ((secondaryWindowType !== WINDOW_TYPES.TEXT_TO_SPEECH
      && secondaryWindowType !== WINDOW_TYPES.IMAGE
      && secondaryWindowType !== WINDOW_TYPES.VIDEO
    && secondaryWindowType !== WINDOW_TYPES.AUDIO) && !isCanvasPresent) {
      toggleVisibleCanvas(true);
    }

    func();
    handleCloseTooltip(label);
    setToolbarItem(label);
  };

  const handleOpenTooltip = (tabId) => {
    tooltipTime = setTimeout(
      () => setToolbarItem(tabId, { isHover: true }), 1000,
    );
  };

  const handleCloseTooltip = (tabId) => {
    clearTimeout(tooltipTime);
    setToolbarItem(tabId, { isHover: false });
  };

  return (
    <div className={classnames('toolbar-container', { 'big-window': !isTimelineOpen })}>
      <div className="toolbar-tabs">
        {items.map(({ label, icon, id: tabId, func, tooltip }) => (
          <HelpIconComponent
            noIcon
            message={tooltip}
            placement="right"
          >
            <button
              className="toolbar-tab"
              key={label}
              onClick={() => onClick(tabId, func)}
              type="button"
              onMouseEnter={() => isExpand && handleOpenTooltip(tabId)}
              onMouseLeave={() => isExpand && handleCloseTooltip(tabId)}
            >
              <div>
                <SVGInline className="toolbar-tab-icon" classSuffix="-inline" svg={icon} cleanup={['title']} />
                <span className="toolbar-tab-title">{label}</span>
              </div>
              {isExpand && (
                <AnimatedWindow
                  isOpen={isExpand}
                  style={{ position: 'absolute' }}
                >
                  <SVGInline className="toolbar-arrow-icon" svg={arrowIcon} cleanup={['title']} />
                </AnimatedWindow>
              )}
            </button>
          </HelpIconComponent>
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
