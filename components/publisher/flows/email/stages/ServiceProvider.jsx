import React, { useRef, useState, useEffect, Fragment } from 'react';
import classnames from 'classnames';

import PropTypes from '../../../../../lib/PropTypes';
import PROVIDERS from '../../../../../lib/constants/campaigns/email-providers';

const ServiceProvider = ({ settings, updateCampaign, generatePersonalizedLink, setLink }) => {
  const { emailProvider } = settings;
  const linkElement = useRef(null);
  const [tooltip, showTooltip] = useState(false);

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
          <ul className="service-provider-list">
            {PROVIDERS.map((item) => (
              <li
                className={classnames('service-provider-list-item', { selected: emailProvider && emailProvider.key === item.key })}
                key={item.key}
              >
                <button
                  type="button"
                  onClick={() => updateCampaign({ emailProvider: item })}
                >
                  {item.value}
                </button>
              </li>
            ))}
          </ul>
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
