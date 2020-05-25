import React from 'react';
import { observer } from 'mobx-react';
import { Waypoint } from 'react-waypoint';
import { CircleLoader } from 'react-spinners';

import { LOADING_COLOR } from '../../lib/constants/ui';
import PropTypes from '../../lib/PropTypes';

const List = observer(({ fetchData, items, isLoading, hasMore }) => (
  <div className="library">
    <div className="library__body">
      <div className="library__row library__row-second">
        {
            items.length
              ? items.map(item => (
                <div
                  key={item._id}
                  className="library__item"
                />
              )) : null
          }
        {
            isLoading
              ? (
                <CircleLoader
                  size={100}
                  css={{ margin: 'auto' }}
                  loading
                  color={LOADING_COLOR}
                />
              )
              : hasMore && <Waypoint onEnter={fetchData} />
          }
      </div>
    </div>
  </div>
));

List.propTypes = {
  hasMore: PropTypes.bool,
  isLoading: PropTypes.bool,
  className: PropTypes.string,
  fetchData: PropTypes.func.isRequired,
  items: PropTypes.arrayOrObservableArrayOf(PropTypes.shape({})),
};

List.defaultProps = {
  items: [],
};


export default List;
