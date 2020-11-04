import React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';
import useUIStore from '../../hooks/useUIStore';

import arrowIcon from '../../../public/static/svgImages/common/arrow-back.svg';
import { WINDOW_TYPES, TOOLBARS } from '../../../lib/constants/ui';

import AnimatedWindow from '../AnimatedWindow';
import HelpIconComponent from '../HelpIcon';

const Toolbar = observer(({ items }) => {
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
    toggleRightBlock,
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
    if ((secondaryWindowType !== WINDOW_TYPES.TEXT_TO_SPEECH && !isCanvasPresent)
      || label !== TOOLBARS.MEDIA) {
      toggleVisibleCanvas(true);
    }

    if ((secondaryWindowType === WINDOW_TYPES.TEXT_TO_SPEECH
      || secondaryWindowType === WINDOW_TYPES.IMAGE
      || secondaryWindowType === WINDOW_TYPES.VIDEO
      || secondaryWindowType === WINDOW_TYPES.AUDIO) && !isCanvasPresent) {
      toggleRightBlock(false);
    }

    func();
    setToolbarItem(label);
  };

  return (
    <div className={classnames('toolbar-container', { 'big-window': !isTimelineOpen })}>
      <div className="toolbar-tabs">
        {items.map(({ label, icon, id: tabId, func, tooltip }) => (
          <button
            className="toolbar-tab"
            key={label}
            onClick={() => onClick(tabId, func)}
            type="button"
          >
            <HelpIconComponent
              noIcon
              message={tooltip}
              placement="right"
            >
              <div>
                <SVGInline className="toolbar-tab-icon" classSuffix="-inline" svg={icon} cleanup={['title']} />
                <span className="toolbar-tab-title">{label}</span>
              </div>
            </HelpIconComponent>
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
