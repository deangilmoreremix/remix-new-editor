import React from 'react';
import classnames from 'classnames';
import { Waypoint } from 'react-waypoint';

import { perPage } from '../../lib/constants/library';

import PropTypes from '../../lib/PropTypes';

import useUIStore from '../hooks/useUIStore';
import useMakeStore from '../hooks/useMakeStore';
import useProjectStore from '../hooks/useProjectStore';

import { showError } from '../../lib/services/alertService';

const BlendModeLibrary = ({ handleClose }) => {
  const [items, setItems] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);

  const { isTimelineOpen } = useUIStore();
  const { getTemplatesBlendMode } = useMakeStore();
  const { addData } = useProjectStore();

  const handleSelect = React.useCallback(async (item) => {
    try {
      await addData(item);
      handleClose();
    } catch (e) {
      await showError(e.message);
    }
  }, []);

  const resetParams = () => {
    setPage(1);
    setHasMore(true);
    setItems([]);
  };

  const getItems = async (reset = false) => {
    if (reset) {
      resetParams();
    }

    if (hasMore) {
      try {
        const results = await getTemplatesBlendMode({
          query: '',
          page,
          perPage,
        });

        setItems([...items, ...results]);
        const hasNextPage = results.length === perPage;
        setHasMore(hasNextPage);

        if (hasNextPage) {
          setPage(page + 1);
        }
      } catch (e) {
        showError(e.message);
      }
    }
  };

  React.useEffect(() => {
    if (page === 1) {
      getItems();
    }
  }, [page]);

  const uploadNewItems = () => {
    if (page !== 1) {
      getItems();
    }
  };

  return (
    <div className={classnames('blendmode-library', { 'big-window': !isTimelineOpen })}>
      <header className="blendmode-header">Blend mode</header>
      <div className="blendmode-body">
        {items.map(item => (
          <div key={item._id} className="blendmode-library__item">
            <img src="" alt="img" />
            <button
              className="animation-preview__add"
              onClick={() => handleSelect(item)}
            />
          </div>
        ))}

        {hasMore && <Waypoint bottomOffset="3%" onEnter={uploadNewItems} />}
      </div>
    </div>
  );
};

BlendModeLibrary.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default BlendModeLibrary;
