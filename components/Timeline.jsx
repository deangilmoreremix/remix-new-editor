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
        <Grid xs={2} container alignItems="center" className="timeline__btns">
          {isLoaded && <PlayButton /> }
          <PlusButton onClick={() => addLayer()} alt="Add Layer" className="timeline-add icon-button" />
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
            componentClasses={{ sliderClass: 'timeline-slider' }}
          />
          )
          }
        </Grid>
        <Grid item xs={1} />
      </Grid>

      <Grid container className="timeline__line">
        <Grid item xs={2} className="timeline__line-arrow"></Grid>
        <Grid item xs={9} className="timeline__line-central"></Grid>
        <Grid item xs={1} className="timeline__line-arrow"></Grid>
      </Grid>

      <Grid container className="layers">
        <Grid item xs={2}>
          <SortableList
            className="layers-settings"
            items={layers}
            onSortEnd={onSortEnd}
            component={Layer}
            idField="order"
            onRemove={(item) => removeLayer(item.id)}
          />
        </Grid>
        <Grid item xs={9} ref={ref} className="without-side-padding timeline-side">
          { isLoaded && <PopcornElements width={width} /> }
        </Grid>
      </Grid>
    </div>
  );
});

export default Timeline;
