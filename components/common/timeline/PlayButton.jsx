import React from 'react';
import { Button } from 'reactstrap';

import { observer } from 'mobx-react';
import useProjectStore from '../../hooks/useProjectStore';

// todo implement it
const PlayButton = observer(() => {
  const projectStore = useProjectStore();
  const { popcorn } = projectStore;
  const [isPlaying, setIsPlaying] = React.useState(false);

  const play = () => {
    if (popcorn.media.paused) {
      setIsPlaying(true);
      popcorn.play();
    } else {
      setIsPlaying(false);
      popcorn.pause();
    }
  };

  return (
    <Button
      onClick={play}
      disabled={!popcorn || !popcorn.media}
    >
      {isPlaying ? 'pause' : 'play'}
    </Button>
  );
});

export default PlayButton;
