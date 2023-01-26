import React, { useMemo, useState } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import { ctaList, lowerThirdList,templatePackList } from '../../../lib/constants/creatives';
import PropTypes from '../../../lib/PropTypes';
import { LIBRARY_KEYS, LIBRARY_TABS } from '../../../lib/constants/library';
import { URL_VIDEO_MODAL } from '../../../lib/constants/modals';

import useModalStore from '../../hooks/useModalStore';
import useUserStore from '../../hooks/useUserStore';

import addUrlIcon from '../../../public/static/svgImages/addurl.svg';
import { useEffect } from 'react';

const CreativeProviderList = observer(({ activeTab, handleButtonClick, activeItem }) => {

  const {
    lowerThirdsEnabled,
    evolutionLowerThirdEnabled, presetsEnabled,
    evolutionPresetEnabled,
    evolutionImageLTPresetEnabled,
    retroLTEnabled,
    neonLTEnabled,
    neonSocialMediaLTEnabled,
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

  const [list, setList] = useState([]);
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
      if(!retroLTEnabled) {
        removeArray.push('RetroLT');
      }
      if(!neonLTEnabled) {
        removeArray.push('neonLT');
      }
      if(!neonSocialMediaLTEnabled) {
        removeArray.push('neonSocialMediaLT');
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
        removeArray.push('BlendMode');
      }
      if (!jsonTransitionEnabled && !evolutionOverlayEnabled) {
        removeArray.push('Overlays');
      }
      if (!neonArrowPackEnabled) {
        removeArray.push('neonArrowPack');
      }
      if (!socialMediaPackEnabled) {
        removeArray.push('socialMediaPack');
      }
      if (!socialMediaButtonPackEnabled) {
        removeArray.push('socialMediaButtonPack');
      }
      const newArr = lowerThirdList.filter(i => !removeArray.some(j => j === i.key));
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
      if (!locationTitlesEnabled) {
        removeArray.push('LocationTitles');
      }
      if (!socialMediaIcon3DEnabled) {
        removeArray.push('SocialMediaIcon3D');
      }
      if (!callOutTitlePageEnabled) {
        removeArray.push('CallOutTitlePackage');
      }
      const newArr = lowerThirdList.filter(i => !removeArray.some(j => j === i.key));
      setList(newArr);
    }
  }, [])

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
              onClick={() => handleButtonClick(list[element].id)}
            >
              {list[element].icon && (
                <SVGInline
                  className="library__icon-btn"
                  svg={list[element].icon}
                  cleanup={[list[element].name]}
                />
              )}
              <p>
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
