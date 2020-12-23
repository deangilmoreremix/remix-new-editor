import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

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
    <div className="layer">
      <div className="layer__block">
        <div className="layer__delete">
          {
            layersCount > 1 ? (
              <div className="layer__flex">
                <SVGInline
                  className="icon trash"
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
        </div>

        <div className="layer__block">
          <input
            className="title reset-input"
            value={name}
            ref={ref}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setIsEdit(true)}
            onBlur={onEdited}
          />

          <div className="layer__flex">
            <SVGInline
              className="icon"
              classSuffix=""
              svg={penIcon}
              cleanup={['title']}
              alt="Edit layer"
              data-tip="Edit layer"
            />
            <button onClick={onEdit} className="icon icon-button svg-fix" type="button" />
          </div>
        </div>
      </div>

      <div className="layer__block">
        <BlendingMode
          layer={item}
        />
        <Opacity
          layer={item}
        />
      </div>
    </div>
  );
});

Layer.propTypes = {
  item: PropTypes.shape({
    name: PropTypes.string,
    defaultName: PropTypes.string,
    id: PropTypes.string.isRequired,
  }).isRequired,
  onRemove: PropTypes.func.isRequired,
};

export default Layer;
