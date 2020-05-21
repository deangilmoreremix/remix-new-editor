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
      <div className="track-name">
        {track}
      </div>
      <div className="volume-container">
        <FormSlider
          containerClassName="volume-input"
          label="Volume"
          onChange={setVolume}
          minValue={0}
          maxValue={100}
          name="volume"
          value={volume}
        />
      </div>
    </div>
  );
});

AudioControls.propTypes = {};

export default AudioControls;
