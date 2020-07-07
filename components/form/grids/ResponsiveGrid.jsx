import React from 'react';
import { observer } from 'mobx-react';
import { Responsive } from 'react-grid-layout';

import PropTypes from '../../../lib/PropTypes';

const ResponsiveGrid = observer((props) => {
  const {
    cols,
    width,
    maxRows,
    layouts,
    className,
    rowHeight,
    marginTop,
    components,
    onDragStop,
    marginLeft,
    compactType,
    onResizeStop,
    preventCollision,
  } = props;

  if (!components || components.length === 0) {
    return null;
  }

  return (
    <Responsive
      className={className || ''}
      cols={{ lg: cols, md: cols, sm: cols, xs: cols, xxs: cols }}
      rowHeight={rowHeight}
      width={width}
      compactType={compactType}
      margin={[marginLeft, marginTop]}
      layouts={{ lg: layouts }}
      onResizeStop={onResizeStop}
      onDragStop={onDragStop}
      preventCollision={preventCollision}
      maxRows={maxRows || Infinity}
      isResizable={false}
    >
      {components}
    </Responsive>
  );
},
);

// todo add class name

ResponsiveGrid.propTypes = {
  maxRows: PropTypes.number,
  onDragStop: PropTypes.func,
  marginTop: PropTypes.number,
  marginLeft: PropTypes.number,
  onResizeStop: PropTypes.func,
  compactType: PropTypes.string,
  preventCollision: PropTypes.bool,
  cols: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  rowHeight: PropTypes.number.isRequired,
  layouts: PropTypes.arrayOrObservableArrayOf(PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    w: PropTypes.number.isRequired,
    h: PropTypes.number.isRequired,
    minW: PropTypes.number.isRequired,
    minH: PropTypes.number.isRequired,
    maxH: PropTypes.number.isRequired,
  })).isRequired,
  components: PropTypes.arrayOrObservableArrayOf(PropTypes.node).isRequired,
};

ResponsiveGrid.defaultProps = {
  marginTop: 10,
  marginLeft: 10,
  compactType: null,
  onDragStop: () => {},
  onResizeStop: () => {},
  preventCollision: true,
};

export default ResponsiveGrid;
