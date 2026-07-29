import React, { useMemo, useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

import { editorStyles } from '../../../lib/constants/editorStyles';
import PropTypes from '../../../lib/PropTypes';
import useUIStore from '../../hooks/useUIStore';
import useUserStore from '../../hooks/useUserStore';

import useTimelineStore from '../../hooks/useTimelineStore';

import arrowIcon from '../../../public/static/svgImages/common/arrow-back.svg';
import { WINDOW_TYPES, TOOLBARS } from '../../../lib/constants/ui';

import AnimatedWindow from '../AnimatedWindow';
import HelpIconComponent from '../HelpIcon';
import { useRouter } from 'next/router';

const Toolbar = observer(({ items }) => {
  const userStore = useUserStore();
  const { videoAutomationCreatorEnabled } = userStore;
  if (videoAutomationCreatorEnabled === false) {
    items = items.filter((e) => e.id !== 'template-generator');
  }
  const {
    toolbarItem: {
      id,
      options,
    },
    setToolbarItem,
    isExpand,
    toggleVisibleCanvas,
    isCanvasPresent,
    secondaryWindowType,
    toggleRightBlock,

  } = useUIStore();
  const {
    pathname,
    query: { isCreativePack, isTextToSpeech },
    push,
  } = useRouter();
  useEffect(() => {
    const creativePack = (isCreativePack === "true");
    const textToSpeech = (isTextToSpeech === "true");

    if (creativePack) {
      const data = items.find(ele => ele.id == 'creatives')
      data.func();
      setToolbarItem('creatives');
    }
    if(textToSpeech) {
      
    }
  }, [])
  const { timelineHeight } = useTimelineStore();
  useEffect(() => {
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
      || secondaryWindowType === WINDOW_TYPES.AUDIO
      || secondaryWindowType === WINDOW_TYPES.AI_ART_GENERATOR
      || secondaryWindowType === WINDOW_TYPES.BG_DIFFUSION) && !isCanvasPresent) {
      toggleRightBlock(false);
    }
    func();
    setToolbarItem(label);
  };
  const libraryHeight = useMemo(() => (
    editorStyles.calculateHeight(timelineHeight - editorStyles.toolbar.differencePX)
  ), [timelineHeight]);

  return (
    <div style={{ height: libraryHeight }} className="toolbar-container">
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
            >

              <div className="toolbar-box">
                <SVGInline className="toolbar-tab-icon" classSuffix="-inline" svg={icon} cleanup={['title']} />
                <span className="toolbar-tab-title">{label}</span>
              </div>

              {isExpand && (
                <AnimatedWindow
                  isOpen={isExpand}
                  style={{ position: 'absolute' }}
                >
                  {tabId !== TOOLBARS.TEMPLATE_GEN && (
                    <SVGInline className="toolbar-arrow-icon" svg={arrowIcon} cleanup={['title']} />
                  )}
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
