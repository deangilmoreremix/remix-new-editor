import React, { useEffect, useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { observer } from 'mobx-react';
import SearchInput from '../../form/SearchInput';
import { LibrarySpinner } from '../../media/Loader';
import useMultiselectTemplateStore from '../../hooks/useMultiselectTemplateStore';
import { initialState, reducer } from '../../../lib/utils/reducers/listReducer';
import useUIStore from '../../hooks/useUIStore';
import { showError } from '../../../lib/services/alertService';
import useProjectStore from '../../hooks/useProjectStore';
import LowerThird from '../../common/lower-thirds/Content';
import { STEPS } from '../../../lib/constants/creatives';
import CreativeProviderList from './CreativeProviderList';
import PresetModal from '../../modals/Presets';
import ImageLtPreset from '../../modals/ImageLTPresets';
import RetroLT from '../RetroLTModal';
import NeonLT from '../NeonLTModal';
import NeonSocialMediaLT from '../NeonSocialMediaLTModal';
import LibraryCTA from '../../common/libraryCTA/LibraryCTA';
import BlendModeLibrary from '../../media/BlendModeLibrary';
import OverlayListTransitions from '../../media/OverlayListTransitions';
import EndScreens from '../EndScreen';
import Connect from '../Connect';
import NeonArraowPack from '../NeonArraowPack';
import SocialMediaPack from '../SocialMediaPack';
import SocialMediaButtonPack from '../SocialMediaButtonPack';
import LocationTitles from '../LocationTitles';
import SocialMediaIcon3D from '../SocialMediaIcon3D';
import CallOutTitlePackage from '../CallOutTitlePackage';


const VIDEO = 'video';

const CreativeModalContent = observer(({ setHeaderProps, handleClose }) => {
  const [activeTab, setTab] = useState(STEPS.LOWERTHIRD)
  const [isLoading, setLoading] = useState(false);
  const [activeItem, setActiveItem] = useState(0);
  const [query, setQuery] = useState('');
  const templateStore = useMultiselectTemplateStore();
  const uiStore = useUIStore();
  const { addData } = useProjectStore();
  const { secondaryWindowType } = uiStore;
  const {
    addElements,
    clearData,
  } = templateStore;

  const setActiveTab = useCallback(async (tab) => {
    setTab(tab);
  }, []);
  const onSelect = React.useCallback(async (entities, item) => {
    addData(item);
    handleClose()
    return false;
  }, []);

  const steps = useMemo(() => [
    {
      content:
        [
          <LowerThird className={"lower-third-list"} onSelect={onSelect} query={query} />,
          <PresetModal handleClose={handleClose} className={"lower-third-list"} query={query}/>,
          <ImageLtPreset handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} />,
          <RetroLT handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} />,
          <NeonLT handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} />,
          <NeonSocialMediaLT handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} />
        ]
    },
    {
      content:
        [<LibraryCTA onSelect={onSelect} className={"lower-third-list"} query={query} />,
        <BlendModeLibrary handleClose={handleClose} query={query} />,
        <OverlayListTransitions className={"lower-third-list"} handleClose={handleClose} query={query} />,
        <NeonArraowPack handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} />,
        <SocialMediaPack handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} />,
        <SocialMediaButtonPack handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} />
        ]
    },
    {
      content:
        [
          <Connect onSelect={onSelect} className={"lower-third-list"} activeTab={activeTab} query={query} />,
          <EndScreens onSelect={onSelect} className={"lower-third-list"} activeTab={activeTab} query={query}/>,
          <LocationTitles onSelect={onSelect} className={"lower-third-list"} activeTab={activeTab} query={query}/>,
          <SocialMediaIcon3D onSelect={onSelect} className={"lower-third-list"} activeTab={activeTab} query={query}/>,
          <CallOutTitlePackage onSelect={onSelect} className={"lower-third-list"} activeTab={activeTab} query={query}/>
        ]
    },
  ], [query]);
  const Content = useMemo(() => {
    return steps[activeTab].content[activeItem]
  }, [query,activeTab, activeItem]);

  useEffect(() => {
    setHeaderProps({ setTab: setActiveTab });
  }, [setActiveTab]);

  useEffect(() => {
    setHeaderProps({ activeTab });
  }, [activeTab]);

  useEffect(() => {
    setActiveItem(0);
    setQuery('');
  }, [activeTab])



  const onNext = useCallback(async () => {
    let hasError = false;
    try {
      setLoading(true);
      await addElements();
    } catch (e) {
      hasError = true;
      showError(e.message);
    } finally {
      setLoading(false);
      clearData();
    }
  }, []);

  const searchElement = (val) => {
    setQuery(val)
  };
  const handleButtonClick = (val) => {
    console.log(val)
    setActiveItem(val);
    setQuery('')
  }

  const disabledButton = useMemo(() => {
    if (isLoading) {
      return true;
    }
  }, [activeTab]);

  return (
    <>
      <div className="generator-body creative">
        <div className='header_search_wrapper'>
          <div className="library__block template__block">
            <CreativeProviderList activeTab={activeTab} handleButtonClick={handleButtonClick} activeItem={activeItem} />
          </div>
          <div className="search">
            <div className="library__search-box search-box">
              <SearchInput onSearch={searchElement} />
            </div>
          </div>
          <div className='search'></div>
        </div>
        {isLoading ? <LibrarySpinner /> : Content}
        <div className="gradient" />
      </div>
    </>
  );
});

CreativeModalContent.propTypes = {
  setHeaderProps: PropTypes.func.isRequired,
};

export default CreativeModalContent;
