import React from 'react';
import classnames from 'classnames';
import { Waypoint } from 'react-waypoint';

import { perPage } from '../../lib/constants/library';

import useUIStore from '../hooks/useUIStore';
import useMakeStore from '../hooks/useMakeStore';
import useProjectStore from '../hooks/useProjectStore';

import { showError } from '../../lib/services/alertService';
import CloseButton from '../common/CloseButton';

const BlendModeLibrary = () => {
  const [items, setItems] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);

  const { isTimelineOpen, toggleRightBlock } = useUIStore();
  const { getTemplatesBlendMode } = useMakeStore();
  const { addData } = useProjectStore();

  const handleSelect = React.useCallback(async (item) => {
    try {
      await addData(item);
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
        <div className="blendmode-items">
          {items.map(item => {
            const element = JSON.parse(item.project.data);
            const { blendMode } = element.media[0].tracks[0];
            const { url } = element.media[0].tracks[0].trackEvents[0].popcornOptions;

            return (
              <div key={item._id} className="blendmode-library__item">
                <div style={{ mixBlendMode: blendMode }}>
                  <img src={url} alt="img" />
                </div>
                <button
                  className="animation-preview__add"
                  onClick={() => handleSelect(item)}
                />
              </div>
            );
          })}

          {hasMore && <Waypoint bottomOffset="3%" onEnter={uploadNewItems}><span className="blendmode-waypoint" /></Waypoint>}
        </div>
        <CloseButton onClick={() => toggleRightBlock(false)} />
      </div>
    </div>
  );
};

export default BlendModeLibrary;
