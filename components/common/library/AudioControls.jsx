import * as React from 'react';
import { observer } from 'mobx-react';

import FormSlider from '../../form/FormSlider';

const AudioControls = observer(({ selected, volume, setVolume }) => {
  const track = React.useMemo(() => {
    if (selected) {
      return selected.title;
    }
    return '';
  }, [selected]);

  return (
    <div className="library__audio-controls">
      <div className="item-name">
        {track}
      </div>
      <FormSlider
        onChange={setVolume}
        minValue={0}
        maxValue={100}
        name="volume"
        value={volume}
      />
    </div>
  );
});

AudioControls.propTypes = {};

export default AudioControls;
