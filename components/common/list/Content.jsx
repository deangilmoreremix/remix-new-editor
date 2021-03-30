import React, { useMemo } from 'react';
import classnames from 'classnames';
import { Waypoint } from 'react-waypoint';
import PropTypes from '../../../lib/PropTypes';
import { LibrarySpinner } from '../../media/Loader';

const Content = ({
  items,
  hasMore,
  uploadNewItems,
  isLoading,
  element: Element,
  className,
  activeItem,
  query,
  withoutParent,
}) => {
  const notFound = useMemo(() => {
    if (isLoading || !query) {
      return null;
    }
    return (<span className={classnames('nothing-found')}>Nothing found</span>);
  }, [isLoading, query]);

  const content = useMemo(() => (
    <>
      {items && items.length ? (
        <>
          {items.map((item) => (
            <Element item={item} key={item._id} activeItem={activeItem} />
          ))}
        </>
      ) : notFound}
      {isLoading && hasMore && <LibrarySpinner />}
      {
        !isLoading && hasMore && (
          <Waypoint bottomOffset="3%" onEnter={uploadNewItems}>
            <span className="list-waypoint" />
          </Waypoint>
        )
      }
    </>
  ), [notFound, activeItem, hasMore, isLoading]);

  return (
    withoutParent ? content : (
      <div className={className}>
        {content}
      </div>
    )
  );
};

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
};
export default Content;
