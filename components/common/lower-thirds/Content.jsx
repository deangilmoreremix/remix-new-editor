import * as React from 'react';
import { Waypoint } from 'react-waypoint';

import useMakeStore from '../../hooks/useMakeStore';
import { showError } from '../../../lib/services/alertService';

import PropTypes from '../../../lib/PropTypes';
import useProjectStore from '../../hooks/useProjectStore';
import useUserStore from '../../hooks/useUserStore';

const perPage = 12;

const Content = ({ className, onSelect }) => {
  const [items, setItems] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);

  const { getRevolutionLowerThird, getEvolutionLowerThird } = useMakeStore();
  const { addData } = useProjectStore();
  const userStore = useUserStore();
  const { lowerThirdsEnabled, evolutionLowerThirdEnabled } = userStore;

  const handleSelect = React.useCallback(async (item) => {
    try {
      await addData(item);
      onSelect();
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
        let results = [];
        let resultsEvolution = [];

        if (lowerThirdsEnabled === true) {
          results = await getRevolutionLowerThird({
            query: '',
            page,
            perPage,
          });
        }

        if (evolutionLowerThirdEnabled === true) {
          resultsEvolution = await getEvolutionLowerThird({
            query: '',
            page,
            perPage,
          });
        }
        const lowerThirdsResult = results.concat(resultsEvolution);
        setItems((prevState) => [...prevState, ...lowerThirdsResult]);
        if (results || resultsEvolution) {
          const hasNextPage = results.length || resultsEvolution.length === perPage;
          setHasMore(hasNextPage);
          if (hasNextPage) {
            setPage(page + 1);
          }
        }
      } catch (e) {
        console.log(e);
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
    <div className={className}>
      {items && items.length
        ? (
          <React.Fragment>
            {items.map((item) => (
              <div key={item._id} className="library-cta-item">
                <div className="inner-wrapper" style={{ backgroundImage: `url(${item.thumbnail})` }} />
                <button className="btn-add" onClick={() => handleSelect(item)}>+</button>
                <span className="title">{item.title}</span>
              </div>
            ))}
          </React.Fragment>
        )
        : null}

      {hasMore && <Waypoint bottomOffset="3%" onEnter={uploadNewItems} />}
    </div>
  );
};

Content.propTypes = {
  className: PropTypes.string,
  onSelect: PropTypes.func,
};

export default Content;
