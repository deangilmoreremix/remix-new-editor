import React, { useRef, useState, useEffect, Fragment } from 'react';

import FormSelect from '../../../../form/FormSelect';

import PropTypes from '../../../../../lib/PropTypes';
import PROVIDERS from '../../../../../lib/constants/campaigns/email-providers';

const ServiceProvider = ({ settings, updateCampaign, generatePersonalizedLink, setLink }) => {
  const { emailProvider } = settings;
  const linkElement = useRef(null);

  const [tooltip, showTooltip] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState();

  useEffect(() => {
    if (linkElement && linkElement.current) {
      setLink(linkElement.current);
    }
  }, [linkElement]);

  const handleCopyLink = (e) => {
    e.preventDefault();
    if (linkElement && linkElement.current) {
      linkElement.current.select();
      document.execCommand('copy');
      linkElement.current.blur();
      handleShowTooltip();
    }
  };

  const onSelectProvider = (item) => {
    setSelectedProvider(item.value);
    updateCampaign({ emailProvider: item });
  };

  const handleShowTooltip = () => {
    if (!tooltip) {
      showTooltip(true);
      setTimeout(() => showTooltip(false), 800);
    }
  };

  return (
    <div className="service-provider">
      <div className="service-provider-inner">
        <div className="service-provider-section">
          <span>Select your Email Service Provider</span>
          <div className="search-input-box">
            <span>Select provider:</span>
            <FormSelect
              dataIsRequired
              value={selectedProvider}
              items={PROVIDERS}
              onChange={onSelectProvider}
            />
          </div>
        </div>
        {emailProvider && (
          <Fragment>
            <div className="service-provider-section personalized-link-section">
              <span>Copy & Paste this PersonalizedLink™ into your email campaign</span>
              <input
                ref={linkElement}
                className="personalized-link"
                type="text"
                value={generatePersonalizedLink()}
                readOnly
                onClick={({ target }) => { target.select(); }}
                title="Double click to copy the link to clipboard"
                onDoubleClick={handleCopyLink}
                style={{ width: '100%' }}
              />
              {tooltip && <span className="tooltip-copied">Copied!</span>}
              <p className="personalized-link-copy">Double-click to copy</p>
            </div>
            <div className="service-provider-section">
              <span>Send your Personalized email campaign</span>
            </div>
          </Fragment>
        )}
      </div>
    </div>
  );
};

ServiceProvider.propTypes = {
  settings: PropTypes.shape({
    emailProvider: PropTypes.shape({
      key: PropTypes.string.isRequired,
    }),
  }).isRequired,
  updateCampaign: PropTypes.func.isRequired,
  generatePersonalizedLink: PropTypes.func.isRequired,
  setLink: PropTypes.func.isRequired,
};

export default ServiceProvider;
