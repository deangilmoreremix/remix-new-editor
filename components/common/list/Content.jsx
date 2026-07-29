import React, { useMemo, memo } from 'react';
import classnames from 'classnames';
import { Waypoint } from 'react-waypoint';
import PropTypes from '../../../lib/PropTypes';
import { LibrarySpinner } from '../../media/Loader';

const Content = memo(({
  items,
  hasMore,
  uploadNewItems,
  isLoading,
  element: Element,
  className,
  activeItem,
  query,
  withoutParent,
  isTable,
}) => {
  function removeDuplicates(myArr, prop) {
    return myArr.filter((obj, pos, arr) => {
      return arr.map((mapObj) => mapObj[prop]).indexOf(obj[prop]) === pos;
    });
  }
  const notFound = useMemo(() => {
    if (isLoading && !query) {
      return null;
    }

    return (
      isTable ? (
        <tr>
          <td className="billing-history-box__table-custom-td">
            <p className={classnames('nothing-found')}>Nothing found</p>
          </td>
        </tr>
      ) : <span className={classnames('nothing-found')}>Nothing found</span>
    );
  }, [isLoading, query, isTable]);

  const content = useMemo(() => (
    <>
      {items && items.length ? (
        removeDuplicates(items,'_id').map((item) => (
          <Element item={item} key={item._id} activeItem={activeItem} />
        ))
      ) : notFound}
      {isLoading && hasMore && (
        isTable ? (
          <tr>
            <td className="billing-history-box__table-custom-td">
              <LibrarySpinner />
            </td>
          </tr>
        ) : <LibrarySpinner />
      )}
      {
        !isLoading && hasMore && (
          isTable ? (
            <tr>
              <td>
                <Waypoint bottomOffset="3%" onEnter={uploadNewItems}>
                  <span className="list-waypoint" />
                </Waypoint>
              </td>
            </tr>
          ) : (
            <Waypoint bottomOffset="3%" onEnter={uploadNewItems}>
              <span className="list-waypoint" />
            </Waypoint>
          )
        )
      }
    </>
  ), [notFound, activeItem, hasMore, isLoading, items, isTable]);

  return (
    withoutParent ? content : (
      <div className={className}>
        {content}
      </div>
    )
  );
});

Content.defaultProps = {
  className: 'list-items',
};

Content.propTypes = {
  items: PropTypes.arrayOrObservableArrayOf(
    PropTypes.shape(),
  ),
  hasMore: PropTypes.bool.isRequired,
  uploadNewItems: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  element: PropTypes.func.isRequired,
  className: PropTypes.string,
  activeItem: PropTypes.oneOfType([
    PropTypes.shape({}),
    PropTypes.string,
  ]),
  query: PropTypes.string,
  withoutParent: PropTypes.bool,
  isTable: PropTypes.bool,
};

export default Content;
