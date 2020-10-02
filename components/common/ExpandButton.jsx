import React from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import useUIStore from '../hooks/useUIStore';
import useProjectStore from '../hooks/useProjectStore';

import expandIcon from '../../public/static/svgImages/header/expand.svg';
import HelpIconComponent from './HelpIcon';
import { headerTooltips } from '../../lib/constants/tooltips';

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
      <div className="expandButton-content">
        <SVGInline
          className="expandButton-icon"
          svg={expandIcon}
          cleanup={['expand']}
        />
        <p>Expand</p>
      </div>
      <HelpIconComponent noPadding message={headerTooltips.expand} />
    </button>
  );
});

export default ExpandButton;
