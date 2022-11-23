import * as React from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import useProjectStore from '../../hooks/useProjectStore';
import useUserStore from '../../hooks/useUserStore';

import PropTypes from '../../../lib/PropTypes';

import { showInfo, showNotice } from '../../../lib/services/alertService';
import HelpIconComponent from '../HelpIcon';

const ProducePanel = observer(({ items, tab, setActiveTab }) => {
  const [isCopied, showIsCopied] = React.useState(false);
  const { item } = useProjectStore();
  const { publishEnabled } = useUserStore();
  
  const onCLick = (action, isActive, errorMessage, url, copiedTooltip, label) => {
    if(publishEnabled && item.published === false) {
      let message = 'Please publish the project first!!';
      if(label == 'Copy playback link') {
        message = 'Please publish your project before copying the link';
      }
      showNotice(message);
      setActiveTab(tab);
      return false;
    }
    if (url && !isActive) {
      showInfo(errorMessage);
      setActiveTab(tab);
    }
    if (isActive) {
      if (!url) {
        action();
      }
      if (url && copiedTooltip) {
        action(url);
        handleShowTooltip();
      }
    } else {
      showInfo(errorMessage);
      setActiveTab(tab);
    }
  };

  const handleShowTooltip = () => {
    if (!isCopied) {
      showIsCopied(true);
      setTimeout(() => showIsCopied(false), 800);
    }
  };

  const svgButton = (label, action, isActive, errorMessage, icon, tooltip, url, copiedTooltip) => (
    <button
      type="button"
      key={label}
      onClick={() => onCLick(action, isActive, errorMessage, url, copiedTooltip, label)}
      className={classnames('produce-panel__button', {
        'produce-panel__button--unactive': !isActive,
      })}
    >
      <HelpIconComponent noIcon message={tooltip}>
        <div className="produce-panel__button">
          <SVGInline
            className="produce-panel__icon"
            svg={icon}
            cleanup={['title']}
          />
          {label}
          {isCopied && copiedTooltip && <p className="personalized-link-copy">{copiedTooltip}</p>}
        </div>
      </HelpIconComponent>
    </button>
  );

  return (
    <div className="produce-block produce-panel">
      {items.map(({
        label,
        action,
        icon,
        tooltip,
        isActive,
        errorMessage,
        url,
        copiedTooltip,
      }) => (
        isActive && url && !copiedTooltip && item.published ? (
          /* eslint-disable-next-line react/jsx-no-target-blank */
          <a key={`${label}-href`} href={url} target="_blank">
            {svgButton(label, action, isActive, errorMessage, icon, tooltip, url)}
          </a>
        ) : svgButton(label, action, isActive, errorMessage, icon, tooltip, url, copiedTooltip)
      ))}
    </div>
  );
});

ProducePanel.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    action: PropTypes.func.isRequired,
    icon: PropTypes.string.isRequired,
    tooltip: PropTypes.string,
    url: PropTypes.string,
    copiedTooltip: PropTypes.string,
  })).isRequired,
  tab: PropTypes.string.isRequired,
  setActiveTab: PropTypes.func.isRequired,
};

export default ProducePanel;
