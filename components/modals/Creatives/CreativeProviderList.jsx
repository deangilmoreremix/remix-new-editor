import React, { useMemo, useState } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import { ctaList, lowerThirdList, templatePackList } from '../../../lib/constants/creatives';
import PropTypes from '../../../lib/PropTypes';
import { LIBRARY_KEYS, LIBRARY_TABS } from '../../../lib/constants/library';
import { URL_VIDEO_MODAL } from '../../../lib/constants/modals';

import useModalStore from '../../hooks/useModalStore';
import useUserStore from '../../hooks/useUserStore';

import addUrlIcon from '../../../public/static/svgImages/addurl.svg';
import { useEffect } from 'react';

const CreativeProviderList = observer(({ activeTab, handleButtonClick, activeItem, func }) => {

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
    musicEnabled,
    quotesEnabled,
    SMPvpBundleEnabled,
    eCommerceEnabled,
    greatTechLayoffEnabled,
    youTubeInterActiveEnabled,
    priceTagsEnabled,
    countDownTimersEnabled,
    millionDollarHackEnabled
  } = useUserStore();
  const [list, setList] = useState([]);
  useEffect(() => {
    func(list)
  }, [list])

  useEffect(() => {
    if (activeTab == 0) {
      setList(lowerThirdList);
    }
    if (activeTab == 1) {
      setList(ctaList)
    }
    if (activeTab == 2) {
      setList(templatePackList)
    }
  }, [activeTab])
  useEffect(() => {
    if (activeTab == 0) {
      const removeArray = [];
      if (!lowerThirdsEnabled && !evolutionLowerThirdEnabled) {
        removeArray.push('LowerThird');
      }
      if (!presetsEnabled && !evolutionPresetEnabled) {
        removeArray.push('LTPreset');
      }
      if (!evolutionImageLTPresetEnabled) {
        removeArray.push('ImageLT');
      }
      if (!retroLTEnabled) {
        removeArray.push('RetroLT');
      }
      if (!neonLTEnabled) {
        removeArray.push('NeonLT');
      }
      if (!neonSocialMediaLTEnabled) {
        removeArray.push('NeonSocialMediaLT');
      }
      if (!socialMediaLTEnabled) {
        removeArray.push('SocialMediaLT');
      }
      if (!musicEnabled) {
        removeArray.push('Music');
      }
      if (!quotesEnabled) {
        removeArray.push('Quotes');
      }
      const newArr = lowerThirdList.filter(i => !removeArray.some(j => j === i.key));
      setList(newArr);
    }
    if (activeTab == 1) {
      const removeArray = [];
      if (!ctaEnabled && !evolutionCtaEnabled) {
        removeArray.push('CTA');
      }
      if (!blendModeEnabled && !evolutionBlendModeEnabled) {
        removeArray.push('BlendModes');
      }
      if (!jsonTransitionEnabled && !evolutionOverlayEnabled) {
        removeArray.push('Overlays');
      }
      if (!neonArrowPackEnabled) {
        removeArray.push('NeonArrowPack');
      }
      if (!locationTitlesEnabled) {
        removeArray.push('LocationTitles');
      }
      
      if (!callOutTitlePageEnabled) {
        removeArray.push('CallOutTitlePackage');
      }
      if (!socialMediaIcon3DEnabled) {
        removeArray.push('SocialMediaIcon3D');
      }
      if (!countDownTimersEnabled) {
        removeArray.push('CountDownTimer');
      }
      if (!priceTagsEnabled) {
        removeArray.push('PriceTags');
      }
      const newArr = ctaList.filter(i => !removeArray.some(j => j === i.key));
      setList(newArr);
    }
    if (activeTab == 2) {
      const removeArray = [];
      if (!connectEnabled) {
        removeArray.push('ConnectForm');
      }
      if (!endScreensEnabled) {
        removeArray.push('EndScreens');
      }
      if (!socialMediaPackEnabled) {
        removeArray.push('SocialMediaPack');
      }
      if (!socialMediaButtonPackEnabled) {
        removeArray.push('SocialMediaButtonPack');
      } 
      
      if (!eCommerceEnabled) {
        removeArray.push('Ecommerce');
      }
      if (!SMPvpBundleEnabled) {
        removeArray.push('SMPvpBunble');
      }
      if (!greatTechLayoffEnabled) {
        removeArray.push('GreatTechLayoff');
      }
      if (!youTubeInterActiveEnabled) {
        removeArray.push('YouTubeInterActive');
      }
      if (!millionDollarHackEnabled) {
        removeArray.push('MillionDollarHack');
      }
      const newArr = templatePackList.filter(i => !removeArray.some(j => j === i.key));
      setList(newArr);
    }
  }, [activeTab])

  return (
    <div className="library__block-sidebar">
      <div className="library__btn-container">
        {
          list && Object.keys(list).map(element => (
            <button
              type="button"
              key={list[element].name}
              className={classnames(
                'library__btn-item',
                {
                  'library__btn-active': activeItem === list[element].id,
                },
              )}
              onClick={() => handleButtonClick(list[element].id, list[element].key)}
            >
              {list[element].icon && (
                <SVGInline
                  className="library__icon-btn"
                  svg={list[element].icon}
                  cleanup={[list[element].name]}
                />
              )}
              <p className='library__btn-title'>
                {list[element].name}
              </p>
            </button>
          ))
        }
      </div>
    </div>
  );
});

export default CreativeProviderList;
