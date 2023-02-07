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
import SocialMediaLT from '../SocialMediaLTModal';
import NeonArraowPack from '../NeonArraowPack';
import SocialMediaPack from '../SocialMediaPack';
import SocialMediaButtonPack from '../SocialMediaButtonPack';
import LocationTitles from '../LocationTitles';
import SocialMediaIcon3D from '../SocialMediaIcon3D';
import CallOutTitlePackage from '../CallOutTitlePackage';
import useUserStore from '../../hooks/useUserStore';


const VIDEO = 'video';

const CreativeModalContent = observer(({ setHeaderProps, handleClose }) => {
  const [activeTab, setTab] = useState(STEPS.LOWERTHIRD)
  const [isLoading, setLoading] = useState(false);
  const [activeEle, setActiveEle] = useState("LowerThird");
  const [activeItem, setActiveItem] = useState(0);
  const [list, setList] = useState([]);
  const [query, setQuery] = useState("");
  const templateStore = useMultiselectTemplateStore();
  const uiStore = useUIStore();
  const { addData } = useProjectStore();
  const { secondaryWindowType } = uiStore;
  const {
    addElements,
    clearData,
  } = templateStore;

  const {
    lowerThirdsEnabled,
    evolutionLowerThirdEnabled, presetsEnabled,
    evolutionPresetEnabled,
    evolutionImageLTPresetEnabled,
    retroLTEnabled,
    neonLTEnabled,
    neonSocialMediaLTEnabled,
    socialMediaLTEnabled,
    evolutionCtaEnabled,
    ctaEnabled,
    blendModeEnabled,
    evolutionBlendModeEnabled,
    evolutionOverlayEnabled,
    jsonTransitionEnabled,
    endScreensEnabled,
    connectEnabled,
    locationTitlesEnabled,
    socialMediaIcon3DEnabled,
    callOutTitlePageEnabled,
    neonArrowPackEnabled,
    socialMediaPackEnabled,
    socialMediaButtonPackEnabled,
  } = useUserStore();

  const setActiveTab = useCallback(async (tab) => {
    setTab(tab);
  }, []);
  const onSelect = React.useCallback(async (entities, item) => {
    addData(item);
    handleClose()
    return false;
  }, []);

  const func = (data) => {
    setList(data)
  }

  useEffect(() => {
    if (list.length) {
      setActiveItem(list[0].id)
      setActiveEle(list[0].key)

    }
  }, [list])


  const steps = useMemo(() => [
    {
      content: []
    },
    {
      content: []
    },
    {
      content: []
    }
  ])

  const Content = useMemo(() => {
    if (lowerThirdsEnabled || evolutionLowerThirdEnabled) {
      steps[activeTab].content.push({ key: 'LowerThird', val: <LowerThird className={"lower-third-list"} onSelect={onSelect} query={query} key={'LowerThird'} /> });
    }
    if (presetsEnabled || evolutionPresetEnabled) {
      steps[activeTab].content.push({ key: 'LTPreset', val: <PresetModal handleClose={handleClose} className={"lower-third-list"} query={query} /> });
    }
    if (evolutionImageLTPresetEnabled) {
      steps[activeTab].content.push({ key: 'ImageLT', val: <ImageLtPreset handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} /> });
    }
    if (retroLTEnabled) {
      steps[activeTab].content.push({ key: 'RetroLT', val: <RetroLT handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} /> });
    }
    if (neonLTEnabled) {
      steps[activeTab].content.push({ key: 'NeonLT', val: <NeonLT handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} /> });
    }
    if (neonSocialMediaLTEnabled) {
      steps[activeTab].content.push({ key: 'NeonSocialMediaLT', val: <NeonSocialMediaLT handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} /> });
    }
    if (socialMediaLTEnabled) {
      steps[activeTab].content.push({ key: 'SocialMediaLT', val: <SocialMediaLT handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} /> });
    }
    if (ctaEnabled && evolutionCtaEnabled) {
      steps[activeTab].content.push({ key: 'CTA', val: <LibraryCTA onSelect={onSelect} className={"lower-third-list"} query={query} /> })
    }
    if (blendModeEnabled || evolutionBlendModeEnabled) {
      steps[activeTab].content.push({ key: 'BlendModes', val: <BlendModeLibrary handleClose={handleClose} query={query} /> });
    }
    if (jsonTransitionEnabled || evolutionOverlayEnabled) {
      steps[activeTab].content.push({ key: 'Overlays', val: <OverlayListTransitions className={"lower-third-list"} handleClose={handleClose} query={query} /> });
    }
    if (neonArrowPackEnabled) {
      steps[activeTab].content.push({ key: 'NeonArrowPack', val: <NeonArraowPack handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} /> });
    }
    if (socialMediaPackEnabled) {
      steps[activeTab].content.push({ key: 'SocialMediaPack', val: <SocialMediaPack handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} /> });
    }
    if (socialMediaButtonPackEnabled) {
      steps[activeTab].content.push({ key: 'SocialMediaButtonPack', val: <SocialMediaButtonPack handleClose={handleClose} className={"lower-third-list"} onSelect={onSelect} activeTab={activeTab} query={query} /> });
    }
    if (connectEnabled) {
      steps[activeTab].content.push({key:'ConnectForm',val:<Connect onSelect={onSelect} handleClose={handleClose} className={"lower-third-list"} activeTab={activeTab} query={query} />});
    }
    if (endScreensEnabled) {
      steps[activeTab].content.push({key:'EndScreens',val: <EndScreens onSelect={onSelect} handleClose={handleClose} className={"lower-third-list"} activeTab={activeTab} query={query}/>});
    }
    if (locationTitlesEnabled) {
      steps[activeTab].content.push({key:'LocationTitles',val:<LocationTitles onSelect={onSelect} handleClose={handleClose} className={"lower-third-list"} activeTab={activeTab} query={query}/>});
    }
    if (socialMediaIcon3DEnabled) {
      steps[activeTab].content.push({key:'SocialMediaIcon3D',val:<SocialMediaIcon3D onSelect={onSelect} handleClose={handleClose} className={"lower-third-list"} activeTab={activeTab} query={query}/>});
    }
    if (callOutTitlePageEnabled) {
      steps[activeTab].content.push({key:'CallOutTitlePackage',val:<CallOutTitlePackage onSelect={onSelect}  handleClose={handleClose} className={"lower-third-list"} activeTab={activeTab} query={query}/>});
    }
    const indexOfContent = steps[activeTab].content.findIndex(ele => ele.key === activeEle);
    if (indexOfContent > -1) {
      return steps[activeTab].content[indexOfContent].val

    }
  }, [query, activeTab, activeItem, list, activeEle]);

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
  const handleButtonClick = (val, key) => {
    setActiveEle(key)
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
            <CreativeProviderList activeTab={activeTab} handleButtonClick={handleButtonClick} activeItem={activeItem} func={func} />
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
