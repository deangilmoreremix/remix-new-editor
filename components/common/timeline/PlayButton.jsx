import React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

import useProjectStore from '../../hooks/useProjectStore';

import playIcon from '../../../public/static/svgImages/common/play.svg';
import pauseIcon from '../../../public/static/svgImages/common/pause.svg';

const PlayButton = observer(() => {
  const projectStore = useProjectStore();
  const { isPlayed, isLoadingSequencer } = projectStore;

  const icon = React.useMemo(() => (isPlayed ? pauseIcon : playIcon), [isPlayed]);

  return (
    <SVGInline
      onClick={projectStore.playPause}
      component="button"
      className="icon-button timeline-play"
      classSuffix=""
      svg={icon}
      cleanup={['title']}
      disabled={isLoadingSequencer}
    />
  );
});

export default PlayButton;
