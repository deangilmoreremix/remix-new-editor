import React from 'react';
import { observer } from 'mobx-react';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';

import PropTypes from '../../lib/PropTypes';


const SortableList = observer(({ onSortEnd, items, className, component: Component, idField, axis, collection, ...rest }) => {
  const Item = React.useMemo(() => SortableElement(({ item }) => <Component item={item} {...rest} />), []);
  const List = React.useMemo(() => SortableContainer(() => (
    <ul className={className}>
      {items.map((item) => (
        <Item
          withRef
          sortIndex={item[idField]}
          className="layer"
          key={`item-${item[idField]}`}
          index={item[idField]}
          item={item}
        />
      ))}
    </ul>
  )), [className, idField, items, rest]);

  return (
    <List onSortEnd={onSortEnd} className={className || ''} items={items} axis={axis || 'y'} />
  );
},
);

SortableList.propTypes = {
  idField: PropTypes.string,
  className: PropTypes.string,
  onSortEnd: PropTypes.func.isRequired,
  component: PropTypes.elementType.isRequired,
  items: PropTypes.arrayOrObservableArrayOf(PropTypes.shape({}).isRequired).isRequired,
};

export default SortableList;
