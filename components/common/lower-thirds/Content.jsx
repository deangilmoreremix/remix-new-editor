import * as React from 'react';
import { Waypoint } from 'react-waypoint';

import useMakeStore from '../../hooks/useMakeStore';
import { showError } from '../../../lib/services/alertService';

import PropTypes from '../../../lib/PropTypes';
import useProjectStore from '../../hooks/useProjectStore';
import useUserStore from '../../hooks/useUserStore';
import useMultiSelectStore from '../../hooks/useMultiSelectStore';
import { CREATIVES_TABS } from '../../../lib/constants/creatives';
import { LibrarySpinner } from '../../media/Loader';

const perPage = 12;

const Content = ({ className, onSelect, query}) => {
  const [items, setItems] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);

  const { getRevolutionLowerThird, getEvolutionLowerThird } = useMakeStore();
  const { getPresets, evolutionPresets } = useMakeStore();

  const templateStore = useMultiSelectStore();
  const { addData } = useProjectStore();
  const userStore = useUserStore();
  const { lowerThirdsEnabled, evolutionLowerThirdEnabled } = userStore;
  const {clearAllSelectedItems} = templateStore;

  const selectMedia = React.useCallback((item) => onSelect(CREATIVES_TABS.LOWER_THIRD, item), []);

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
        setIsLoading(true);
        let results = [];
        let resultsEvolution = [];
        if (lowerThirdsEnabled === true) {
          results = await getRevolutionLowerThird({
            query: query,
            page,
            perPage,
          });
        }

        if (evolutionLowerThirdEnabled === true) {
          resultsEvolution = await getEvolutionLowerThird({
            query: query,
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
        setIsLoading(false);
      } catch (e) {
        console.log(e);
        setIsLoading(false);
        showError(e.message);
      }
    }
  };

  React.useEffect(() => {
    getItems();
  },[query])

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
                <button className="btn-add" onClick={() => selectMedia(item)}>+</button>
                <span className="title">{item.title}</span>
              </div>
            ))}
          </React.Fragment>
        )
        : null}
        
        {isLoading && hasMore && (
        (
          <tr>
            <td className="billing-history-box__table-custom-td">
              <LibrarySpinner />
            </td>
          </tr>
        ) 
      )}        
      {hasMore && <Waypoint bottomOffset="3%" onEnter={uploadNewItems} />}
    </div>
  );
};

Content.propTypes = {
  className: PropTypes.string,
  onSelect: PropTypes.func,
};

export default Content;
