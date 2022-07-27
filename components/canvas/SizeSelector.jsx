import React, { useMemo, useRef,useEffect } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import isEqual from 'lodash/isEqual';

import useUIStore from '../hooks/useUIStore';
import useTimelineStore from '../hooks/useTimelineStore';
import { editorStyles } from '../../lib/constants/editorStyles';

import PropTypes from '../../lib/PropTypes';

const baseDimension = 2;

const SizeSelector = observer(({ active, sizes, onChange }) => {
  const selectorRef = useRef(null);

  const { isCanvasPresent } = useUIStore();
  const { timelineHeight } = useTimelineStore();

  const getStyle = ({ width, height }) => {
    const ratio = width / height;

    return {
      minWidth: `${ratio > 1 ? ratio * baseDimension : baseDimension}rem`,
      minHeight: `${ratio > 1 ? baseDimension : baseDimension / ratio}rem`,
    };
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = './static/js/togetherjs/togetherjs-min.js';
    script.async = true;
    document.body.appendChild(script)
  },[]);


  const positionTop = useMemo(() => {
    if (selectorRef?.current) {
      const selectorHeight = selectorRef.current.getBoundingClientRect().height;
      return `calc((${editorStyles.pageHeightWithoutHeader} - ${selectorHeight / 2 + timelineHeight}px)/2)`;
    }
  }, [timelineHeight, selectorRef]);

  return (
    <div ref={selectorRef} style={{ top: positionTop }} className={classnames('canvas-size-selector', { hidden: !isCanvasPresent })}>
      {sizes.map(({ width, height }) => (
        <button
          key={`${width}:${height}`}
          className={classnames(
            'canvas-size-item',
            {
              active: isEqual({ width, height }, active),
            })}
          onClick={() => onChange({ ratio: { width, height } })}
          type="button"
          style={getStyle({ width, height })}
        >
          {`${width}:${height}`}
        </button>
      ))}
     
      <button onClick={() => {
        TogetherJS(this);
        return false
      }}>Collaborate</button>
    </div>
  );
});

SizeSelector.propTypes = {
  active: PropTypes.shape({
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
  }).isRequired,
  sizes: PropTypes.arrayOf(
    PropTypes.shape({
      width: PropTypes.number.isRequired,
      height: PropTypes.number.isRequired,
    }).isRequired,
  ),
  onChange: PropTypes.func.isRequired,
};

export default SizeSelector;
