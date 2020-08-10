import React from 'react';
import { observer } from 'mobx-react';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';

import PropTypes from '../../lib/PropTypes';

const SortableList = observer((props) => {
  const {
    sortById,
    items,
    idField,
    onSortEnd,
    className,
    valueDistance,
    component: Component,
    ...rest
  } = props;
  const Item = React.useMemo(
    () => SortableElement(({ item }) => <Component item={item} {...rest} />), [rest]);
  const List = React.useMemo(() => SortableContainer(() => (
    <ul className={className}>
      {items.map((item, index) => (
        <Item
          withRef
          sortIndex={item[sortById] || item[sortById]}
          className="layer"
          key={`item-${item[idField] || item[sortById]}`}
          index={item[idField] || index}
          item={item}
        />
      ))}
    </ul>
  )), [className, idField, items]);

  return (
    <List onSortEnd={onSortEnd} distance={valueDistance} className={className || ''} items={items} />
  );
},
);

SortableList.propTypes = {
  valueDistance: PropTypes.number,
  sortById: PropTypes.string,
  idField: PropTypes.string,
  className: PropTypes.string,
  onSortEnd: PropTypes.func.isRequired,
  component: PropTypes.elementType.isRequired,
  items: PropTypes.arrayOrObservableArrayOf(PropTypes.shape({}).isRequired).isRequired,
};

SortableList.defaultProps = {
  valueDistance: 0,
};

export default SortableList;
