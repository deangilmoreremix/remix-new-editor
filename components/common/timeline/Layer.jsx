import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import Grid from '@material-ui/core/Grid';

import useProjectStore from '../../hooks/useProjectStore';

import penIcon from '../../../public/static/svgImages/common/pen.svg';
import trashIcon from '../../../public/static/svgImages/common/trash.svg';

import BlendingMode from './BlendingMode';
import Opacity from './Opacity';

import PropTypes from '../../../lib/PropTypes';

const Layer = observer(({ item, onRemove }) => {
  const projectStore = useProjectStore();
  const { layers, editLayer } = projectStore;
  const ref = useRef(null);
  const [isEdit, setIsEdit] = useState(false);
  const [name, setName] = useState(item.name || item.defaultName);

  const layersCount = React.useMemo(() => layers.length, [layers.length]);

  const onEdit = () => {
    setIsEdit(!isEdit);
  };

  const onEdited = () => {
    editLayer(item.id, { name });
    if (!name) {
      setName(item.defaultName);
    }
  };

  useEffect(() => {
    if (ref.current) {
      if (isEdit) {
        ref.current.focus();
      } else {
        ref.current.blur();
      }
    }
  }, [isEdit]);

  return (
    <Grid container className="layer flex-center">
      <Grid item xs={5}>
        <Grid container className="flex-center">
          <Grid item xs={3} className="without-side-padding flex-center">
            {
              layersCount > 1 ? (
                <div className="flex-center">
                  <SVGInline
                    className="icon"
                    classSuffix=""
                    svg={trashIcon}
                    cleanup={['title']}
                    alt="Remove layer"
                    data-tip="Remove layer"
                  />
                  <button onClick={() => onRemove(item)} className="icon icon-button svg-fix" type="button" />
                </div>
              ) : null
            }
          </Grid>
          <Grid item xs={5} className="without-side-padding">
            <input
              className="title reset-input"
              value={name}
              ref={ref}
              onChange={(e) => { setName(e.target.value); }}
              onFocus={() => setIsEdit(true)}
              onBlur={onEdited}
            />
          </Grid>
          <Grid item xs={4} className="without-side-padding flex-center">
            <SVGInline
              className="icon"
              classSuffix=""
              svg={penIcon}
              cleanup={['title']}
              alt="Edit layer"
              data-tip="Edit layer"
            />
            <button onClick={onEdit} className="icon icon-button svg-fix" type="button" />
          </Grid>
        </Grid>
      </Grid>
      <Grid item xs={7}>
        <Grid container>
          <Grid item xs={6} className="without-side-padding">
            <BlendingMode
              layer={item}
            />
          </Grid>
          <Grid item xs={2} className="without-side-padding">
            <Opacity
              layer={item}
            />
          </Grid>
          <Grid item xs={2} className="without-side-padding">
            {/* todo implement it */}
          </Grid>
          <Grid item xs={2} className="without-side-padding">
            {/* todo implement locked */}
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
},
);

Layer.propTypes = {
  item: PropTypes.shape({
    name: PropTypes.string,
    defaultName: PropTypes.string,
    id: PropTypes.string.isRequired,
  }).isRequired,
  onRemove: PropTypes.func.isRequired,
};

export default Layer;
