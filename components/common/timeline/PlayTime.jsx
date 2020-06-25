import React, { useMemo, useState, useRef } from 'react';
import { observer } from 'mobx-react';

import useProjectStore from '../../hooks/useProjectStore';

import FormTextField from '../../form/FormTextField';
import { toSeconds, toTimecode } from '../../../lib/utils/time';
import { SANTISECOND } from '../../../lib/constants/project';

const PlayTime = observer(() => {
  const inputRef = useRef();
  const [newDuration, setDuration] = useState(null);
  const projectStore = useProjectStore();
  const { time, duration: currentDuration, changeDuration } = projectStore;
  const currentTime = useMemo(() => toTimecode(time / SANTISECOND, 2), [time]);

  const onDurationChange = (value, elem) => {
    const caretPoint = elem.selectionStart === 0 ? 1 : elem.selectionStart;
    const inputedValue = value.slice(caretPoint - 1, caretPoint);

    if (/\d|:|\./.test(inputedValue)) {
      setDuration(value);
    }
  };

  return (
    <div className="play-time">
      <div className="time-current">
        {currentTime}
      </div>
      <FormTextField
        className="time-total"
        onChange={(v) => onDurationChange(v, inputRef.current)}
        onEnter={(v) => { changeDuration(toSeconds(v)); }}
        value={newDuration || toTimecode(currentDuration / SANTISECOND, 2)}
        onBlur={() => (newDuration ? changeDuration(toSeconds(newDuration))
          : changeDuration(toSeconds(currentDuration)))}
        ref={inputRef}
      />
    </div>
  );
});

export default PlayTime;
