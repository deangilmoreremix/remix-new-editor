import React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

import useProjectStore from '../../hooks/useProjectStore';

import playIcon from '../../../public/static/svgImages/common/play.svg';
import pauseIcon from '../../../public/static/svgImages/common/pause.svg';

const PlayButton = observer(({ endDateWithZoom, startDate }) => {
  const projectStore = useProjectStore();
  const { isPlayed, isLoadingSequencer, playPause, updateTime, time } = projectStore;

  const icon = React.useMemo(() => (isPlayed ? pauseIcon : playIcon), [isPlayed]);

  const onClick = async () => {
    if (time * 10 > endDateWithZoom.diff(startDate)) {
      await updateTime(endDateWithZoom.diff(startDate) / 10);
    }
    playPause();
  };

  return (
    <SVGInline
      onClick={onClick}
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
