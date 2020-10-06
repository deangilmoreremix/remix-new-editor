import React from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import useUIStore from '../hooks/useUIStore';
import useProjectStore from '../hooks/useProjectStore';

import expandIcon from '../../public/static/svgImages/header/expand.svg';
import { headerTooltips } from '../../lib/constants/tooltips';
import TimeoutTooltip from './TimeoutTooltip';

const ExpandButton = observer(() => {
  const {
    closeAllWindows,
    isExpand,
  } = useUIStore();

  const { releaseElement } = useProjectStore();

  const onCLick = () => {
    closeAllWindows();
    releaseElement();
  };

  return (
    <button
      className={classnames('expandButton', { 'expandButton-active': isExpand })}
      onClick={onCLick}
    >
      <TimeoutTooltip message={headerTooltips.expand}>
        <div className="expandButton-content">
          <SVGInline
            className="expandButton-icon"
            svg={expandIcon}
            cleanup={['expand']}
          />
          <p>Expand</p>
        </div>
      </TimeoutTooltip>
    </button>
  );
});

export default ExpandButton;
