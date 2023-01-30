import * as React from 'react';
import { Waypoint } from 'react-waypoint';

import useMakeStore from '../../hooks/useMakeStore';
import { showError } from '../../../lib/services/alertService';

import PropTypes from '../../../lib/PropTypes';
import useUserStore from '../../hooks/useUserStore';
import { CREATIVES_TABS } from '../../../lib/constants/creatives';

const perPage = 12;

const LibraryCTA = ({ className, onSelect, query }) => {
  const [items, setItems] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [queryData,setQueryData] = React.useState([]);
  const { getTemplatesCTA, getEvolutionTemplatesCTA } = useMakeStore();
  const userStore = useUserStore();
  const { evolutionCtaEnabled, ctaEnabled } = userStore;
  const selectMedia = React.useCallback((item) => onSelect(CREATIVES_TABS.CTA_MODES, item), []);

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
        if (ctaEnabled === true) {
          results = await getTemplatesCTA({
            query: '',
            page,
            perPage,
          });
        }

        if (evolutionCtaEnabled === true) {
          resultsEvolution = await getEvolutionTemplatesCTA({
            query: '',
            page,
            perPage,
          });
        }
        const templateCTA = results.concat(resultsEvolution);
        setItems((prevState) => [...prevState, ...templateCTA]);
        if (results || resultsEvolution) {
          const hasNextPage = results.length || resultsEvolution.length === perPage;
          setHasMore(hasNextPage);

          if (hasNextPage) {
            setPage(page + 1);
          }
        }
      } catch (e) {
        showError(e.message);
      }
    }
  };

  function removeDuplicates(myArr, prop) {
    return myArr.filter((obj, pos, arr) => {
      return arr.map((mapObj) => mapObj[prop]).indexOf(obj[prop]) === pos;
    });
  }

  React.useEffect(() => {
    if (query !== '') {
      const filterData = items.filter(x => x.title.toLowerCase().includes(query.toLowerCase()));
      setQueryData(filterData)
    }
    else {
      setQueryData([]);
    }
  }, [query])

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
      {queryData.length ?
        <React.Fragment>
        {removeDuplicates(queryData,'title').map((item) => (
          <div key={item._id} className="library-cta-item">
            <div className="inner-wrapper" style={{ backgroundImage: `url(${item.thumbnail})` }} >
              <button className="btn-add" onClick={() => selectMedia(item)}>+</button>
              <span className="title">{item.title}</span>
            </div>
          </div>
        ))}
      </React.Fragment>
      : null
      }
      {
        !queryData.length &&
        <React.Fragment>
          {items.map((item) => (
            <div  className="library-cta-item">
              <div className="inner-wrapper" style={{ backgroundImage: `url(${item.thumbnail})` }} >
                <button className="btn-add" onClick={() => selectMedia(item)}>+</button>
                <span className="title">{item.title}</span>
              </div>
            </div>
          ))}
        </React.Fragment>
      }
      {hasMore && <Waypoint bottomOffset="3%" onEnter={uploadNewItems} />}
    </div>
  );
};

LibraryCTA.propTypes = {
  className: PropTypes.string,
  onSelect: PropTypes.func,
};

export default LibraryCTA;
