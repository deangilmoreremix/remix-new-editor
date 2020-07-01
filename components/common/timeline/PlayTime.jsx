import React, { useMemo, useState, useEffect } from 'react';
import { observer } from 'mobx-react';

import useProjectStore from '../../hooks/useProjectStore';

import FormTextField from '../../form/FormTextField';
import { toSeconds, toTimecode } from '../../../lib/utils/time';
import { SANTISECOND } from '../../../lib/constants/project';

const PlayTime = observer(() => {
  const [newDuration, onDurationChange] = useState(null);
  const projectStore = useProjectStore();
  const { time, duration: currentDuration, changeDuration } = projectStore;
  const currentTime = useMemo(() => toTimecode(time / SANTISECOND, 2), [time]);

  useEffect(() => {
    onDurationChange(toTimecode(currentDuration / SANTISECOND, 2));
  }, [currentDuration]);

  return (
    <div className="play-time">
      <div className="time-current">
        {currentTime}
      </div>
      <FormTextField
        className="time-total"
        onChange={(v) => onDurationChange(v)}
        onEnter={(v) => { changeDuration(toSeconds(v) * SANTISECOND); }}
        value={newDuration}
        onBlur={() => (newDuration ? changeDuration(toSeconds(newDuration) * SANTISECOND)
          : changeDuration(toSeconds(currentDuration)))}
      />
    </div>
  );
});

export default PlayTime;
