import React, { useRef, useEffect } from 'react';
import { observer } from 'mobx-react';
import Grid from '@material-ui/core/Grid';

import useProjectStore from './hooks/useProjectStore';

import FormSlider from './form/FormSlider';
import Layer from './common/timeline/Layer';
import SortableList from './common/SortableList';
import PlayButton from './common/timeline/PlayButton';
import PlusButton from './common/timeline/PlusButton';
import PopcornElements from './common/timeline/PopcornElements';

const Timeline = observer(() => {
  const ref = useRef(null);
  const projectStore = useProjectStore();
  const [width, setWidth] = React.useState(0);

  const {
    time,
    layers,
    duration,
    isLoaded,
    addLayer,
    updateTime,
    removeLayer,
    moveElements,
  } = projectStore;

  const onSortEnd = ({ oldIndex, newIndex }) => {
    if (oldIndex === newIndex) {
      return;
    }
    moveElements(oldIndex, newIndex);
  };

  useEffect(() => {
    if (ref.current) {
      setWidth(ref.current.offsetWidth);
    }
  }, []);

  return (
    <div className="timeline">
      <Grid container>
        <Grid item xs={2}>
          {isLoaded && <PlayButton /> }
          <PlusButton onClick={() => addLayer()} alt="Add Layer" className="icon" />
        </Grid>
        <Grid item xs={9}>
          {isLoaded && (
          <FormSlider
            minValue={0}
            maxValue={duration}
            sliderWidth={width}
            withoutInput
            value={time}
            onChange={(value) => updateTime(value)}
          />
          )
          }
        </Grid>
        <Grid item xs={1} />
      </Grid>
      <Grid container className="layers">
        <Grid item xs={2}>
          <SortableList
            className="layers-settings full-height"
            items={layers}
            onSortEnd={onSortEnd}
            component={Layer}
            idField="order"
            onRemove={(item) => removeLayer(item.id)}
          />
        </Grid>
        <Grid item xs={9} ref={ref} className="without-side-padding full-height">
          { isLoaded && <PopcornElements width={width} /> }
        </Grid>
      </Grid>
    </div>
  );
});

export default Timeline;
