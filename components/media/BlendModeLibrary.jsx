import React from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import useUIStore from '../hooks/useUIStore';
import useMakeStore from '../hooks/useMakeStore';

import List from '../common/list/List';
import Element from '../common/list/Element';
import CloseButton from '../common/CloseButton';

const BlendModeLibrary = observer(() => {
  const { isTimelineOpen, toggleRightBlock } = useUIStore();
  const { getTemplatesBlendMode } = useMakeStore();

  return (
    <div className={classnames('blendmode-library', { 'big-window': !isTimelineOpen })}>
      <header className="blendmode-header">Blend mode</header>
      <div className="blendmode-body">
        {/*<div className="blendmode-items">*/}
        {/*  {items.map(item => {*/}
        {/*    const element = JSON.parse(item.project.data);*/}
        {/*    const { blendMode } = element.media[0].tracks[0];*/}
        {/*    const { url } = element.media[0].tracks[0].trackEvents[0].popcornOptions;*/}

        {/*    return (*/}
        {/*      <div key={item._id} className="blendmode-library__item">*/}
        {/*        <div style={{ mixBlendMode: blendMode }}>*/}
        {/*          <img src={url} alt="img" />*/}
        {/*        </div>*/}
        {/*        <button*/}
        {/*          className="animation-preview__add"*/}
        {/*          onClick={() => handleSelect(item)}*/}
        {/*        />*/}
        {/*      </div>*/}
        {/*    );*/}
        {/*  })}*/}
        {/*</div>*/}
        <List
          get={getTemplatesBlendMode}
          className="blendmode-items"
          element={Element}
        />
        <CloseButton onClick={() => toggleRightBlock(false)} />
      </div>
    </div>
  );
});

export default BlendModeLibrary;
