import React from 'react';
import { Button } from 'reactstrap';

import { observer } from 'mobx-react';
import useProjectStore from '../../hooks/useProjectStore';

// todo implement it
const PlayButton = observer(() => {
  const projectStore = useProjectStore();
  const { popcorn } = projectStore;
  const [name, setName] = React.useState('play');

  const play = () => {
    if (popcorn.media.paused) {
      setName('pause');
      popcorn.play();
    } else {
      setName('play');
      popcorn.pause();
    }
  };

  return (
    <Button onClick={play} disabled={!popcorn || !popcorn.media}>{name}</Button>
  );
});

export default PlayButton;
