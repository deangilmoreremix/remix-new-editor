import * as React from 'react';

import PropTypes from '../../../../../lib/PropTypes';
import { isEnoughFans } from '../../../../../lib/utils/social-campaigns';


const FacebookPage = ({ settings, updateCampaign, provider }) => (
  <div className="facebook-page">
    <h5 className="embed-title">
      Which one of your Facebook Pages do you want to embed your Video into?
    </h5>
    <div className="embed-grid__layout">
      <div className="row embed-group">
        <label className="col-md-4" htmlFor="facebook-page-select">
          Facebook pages
        </label>
        <div className="col-md-8">
          <select
            id="facebook-page-select"
            className="cell"
            name="select"
            value={settings.selectedFbPage || ''}
            onChange={async ({ target: { value } }) => {
              const fbPage = settings.facebookPages.find(page => page.id === value);
              const selectedFbPage = value;
              const facebookPageTab = await provider
                .getPageTabs(fbPage.id, fbPage.token);
              updateCampaign({ selectedFbPage, facebookPageTab });
            }}
          >
            {settings.facebookPages && settings.facebookPages.map(
              ({ id, name }) => <option key={id} value={id}>{name}</option>,
            )}
          </select>
        </div>

      </div>
      {
        settings.selectedFbPage
        && (isEnoughFans(settings.facebookPages.find(page => page.id === settings.selectedFbPage)))
          ? (
            <div className="row embed-group">
              <label className="cell" htmlFor="facebook-page-tab-input">
                Facebook Page tab name
              </label>
              <input
                id="facebook-page-tab-input"
                className="cell facebook-page-tab"
                type="text"
                value={settings.facebookPageTab.name}
                onChange={({ target: { value } }) => {
                  const name = value;
                  updateCampaign({
                    facebookPageTab: {
                      ...settings.facebookPageTab,
                      name,
                    },
                  });
                }}
              />
            </div>
          ) : null
      }
    </div>
    {!settings.selectedFbPage
    || (isEnoughFans(settings.facebookPages.find(
      page => page.id === settings.selectedFbPage,
    )))
      ? (
        <div className="warning">
          <strong>Warning! </strong>
          The selected page has less than 2,000 fans. As a result, and due to a
          new Facebook limitation introduced on February 5th, 2018, your video can only be
          shared on Facebook and not embedded in a tab. This will be corrected soon.
        </div>
      ) : null}
  </div>
);

FacebookPage.propTypes = {
  settings: PropTypes.shape({
    userData: PropTypes.shape({}),
    postData: PropTypes.shape({
      link: PropTypes.string,
      title: PropTypes.string,
      description: PropTypes.string,
      thumbnail: PropTypes.string,
    }),
    facebookPageTab: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
    })),
    facebookPages: PropTypes.array,
    selectedFbPage: PropTypes.string,
    embedLocation: PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      prompt: PropTypes.string,
      embedGenerator: PropTypes.func,
    }),
    preload: PropTypes.bool,
  }).isRequired,
  project: PropTypes.shape({
    url: PropTypes.string.isRequired,
  }).isRequired,
  updateCampaign: PropTypes.func.isRequired,
  provider: PropTypes.shape({
    logIn: PropTypes.func.isRequired,
    getPageTabs: PropTypes.func.isRequired,
  }).isRequired,
};

export default FacebookPage;
