import React, { useEffect, useState, useReducer, useCallback } from 'react';
import { observer } from 'mobx-react';
import { tabItems } from '../../../lib/constants/library';
import useMediaStore from '../../hooks/useMediaStore';
import { initialState, reducer } from '../../../lib/utils/reducers/listReducer';
import ProviderList from '../../common/library/ProviderList';
import SearchInput from '../../form/SearchInput';
import { ACTION_TYPES } from '../../../lib/constants/reducers/listReducer';
import List from '../../common/gallery/List';
import { ASSET_TYPES } from '../../../lib/constants/media';
import VideoTemplate from '../../common/projectDataList/VideoTemplate';
import { PREVIEW_MEDIA_MODAL } from '../../../lib/constants/modals';
import useModalStore from '../../hooks/useModalStore';
import PropTypes from '../../../lib/PropTypes';
import { entities } from '../../../lib/constants/templateGenerator';

const PER_PAGE = 15;

const Media = observer(({ onSelect }) => {
  const {
    videoTemplateProvidersInfo,
    getAssets,
  } = useMediaStore();

  const firstProvider = React.useMemo(() => Object.keys(videoTemplateProvidersInfo)[0],
    [videoTemplateProvidersInfo]);

  const [state, dispatch] = useReducer(reducer, initialState);
  const [activeBtn, setActiveBtn] = useState(firstProvider);
  const { openModal } = useModalStore();

  const onPreview = React.useCallback((options) => (e) => {
    openModal(PREVIEW_MEDIA_MODAL, {
      item: options.item, activeTab: 'VIDEO', volume: 100, mute: false, hasUse: false,
    });
    e.stopPropagation();
  }, []);

  const selectMedia = useCallback((item) => onSelect(entities.VIDEO, item), []);

  useEffect(() => {
    dispatch({
      type: ACTION_TYPES.SET_INITIAL,
      value: {
        path: 'api/users/me/media-assets',
        provider: {
          providerName: activeBtn,
          assetType: ASSET_TYPES.VIDEO,
          getList: getAssets,
        },
        query: state.query,
        content: (options) => (
          <VideoTemplate
            className="video__item"
            onPreview={onPreview(options)}
            onSelect={(item) => selectMedia(item)}
            needSelect
            {...options}
          />
        ),
        perPage: PER_PAGE,
        orderBy: {
          createdAt: -1,
        },
      },
    });
  }, [activeBtn]);

  const handleButtonClick = React.useCallback((element) => {
    setActiveBtn(element);
  }, [activeBtn]);

  const renderSidebar = React.useCallback(() => (
    <ProviderList
      activeItem={activeBtn}
      title={tabItems.VIDEO.find}
      handleButtonClick={handleButtonClick}
      list={videoTemplateProvidersInfo}
    />
  ), [activeBtn, videoTemplateProvidersInfo]);

  const searchElement = (q) => {
    dispatch({
      type: ACTION_TYPES.SET_QUERY,
      value: q,
    });
  };

  return (
    <>
      <div className="library__block template__block">
        <span>Find Free videos</span>
        {renderSidebar()}
      </div>
      <div className="search">
        <h4 className="search-title">Choose your template</h4>
        <div className="library__search-box search-box">
          <SearchInput onSearch={searchElement} />
        </div>
      </div>
      <List
        list={state}
        dispatchList={dispatch}
        activeBtn={activeBtn}
        className="generator-list video-list"
      />
    </>
  );
});

Media.propTypes = {
  onSelect: PropTypes.func.isRequired,
};

export default Media;
