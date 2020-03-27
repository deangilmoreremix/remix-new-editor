import React, { useRef, useEffect } from 'react';
import arrayMove from 'array-move';
import { observer } from 'mobx-react';
import Grid from '@material-ui/core/Grid';

import useProjectStore from './hooks/useProjectStore';

import PlayButton from './common/timeline/PlayButton';
import SortableList from './common/SortableList';
import PlusButton from './common/timeline/PlusButton';
import PopcornElements from './common/timeline/PopcornElements';
import Layer from './common/timeline/Layer';
import FormSlider from './form/FormSlider';

const Timeline = observer(() => {
  const projectStore = useProjectStore();
  const { layers, isLoaded, addLayer, removeLayer, updateTime, duration, time, moveElements } = projectStore;
  const ref = useRef(null);

  const onSortEnd = ({ oldIndex, newIndex }) => {
    if (oldIndex === newIndex) {
      return;
    }
    moveElements(oldIndex, newIndex);
  };

  const addNewLayer = () => {
    addLayer();
  };

  const onChangeTime = (value) => {
    updateTime(value);
  };

  const onRemove = (item) => {
    removeLayer(item.id);
  };

  useEffect(() => {
    if (ref.current) {
      setWidth(ref.current.offsetWidth);
    }
  }, []);

  const [width, setWidth] = React.useState(0);

  // todo calculate width
  // todo add Remove
  return (
    <div className="timeline">
      <Grid container>
        <Grid item xs={2}>
          {isLoaded && <PlayButton /> }
          <PlusButton onClick={addNewLayer} alt="Add Layer" className="icon" />
        </Grid>
        <Grid item xs={9}>
          {isLoaded && (
          <FormSlider
            minValue={0}
            maxValue={duration}
            sliderWidth={width}
            withoutInput
            value={time}
            onChange={onChangeTime}
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
            onRemove={onRemove}
          />
        </Grid>
        <Grid item xs={9} ref={ref} className="without-side-padding full-height">
          {/* <Ff /> */}
          { isLoaded && <PopcornElements width={width} /> }
          {/* <div ref={ref} className="stager-wrapper"> */}
          {/* <div style={style} ref={wrapper} className="embed-wrapper"> */}
          {/* <div id="video-container" className="video-container"> */}
          {/* <div */}
          {/* id="video" */}
          {/* className="video" */}
          {/* webkit-playsinline */}
          {/* /> */}
          {/* </div> */}
          {/* </div> */}
          {/* </div> */}
        </Grid>
      </Grid>
    </div>
  );
});

export default Timeline;
