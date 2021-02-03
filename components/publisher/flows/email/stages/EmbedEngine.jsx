import * as React from 'react';

import {
  DEFAULT,
  EMAIL_EMBED_LOCATIONS,
  WORDPRESS,
} from '../../../../../lib/constants/campaigns/constants';
import EmbedDataContainer from '../../../EmbedDataContainer';
import PropTypes from '../../../../../lib/PropTypes';
import FormSelect from '../../../../form/FormSelect';
import { DEFAULT_THUMBNAIL } from '../../../../../lib/constants/project';


const EmbedEngine = ({ settings, updateCampaign, project }) => {
  const { embedLocation, preload } = settings;
  return (
    <div className="embed-engine">
      <h5 className="embed-title">Where do you want to embed your video?</h5>
      <div className="embed-grid">
        {embedLocation && (
          <div className="embed-group mb-3">
            <label className="cell row" htmlFor="embed-location-select">
              <div className="col-md-4">Embed Location</div>
              <div className="col-md-8">
                <FormSelect
                  className=""
                  labelClassName=""
                  selectClassName=""
                  value={embedLocation.key}
                  onChange={
                    (value) => updateCampaign({
                      embedLocation: EMAIL_EMBED_LOCATIONS.find(item => item.key === value),
                    })
                  }
                  items={
                    EMAIL_EMBED_LOCATIONS.map(
                      ({ key, label }) => ({ value: key, label }),
                    )
                  }
                />
              </div>
            </label>
          </div>
        )}
        <div className="embed-group mb-3">
          <label className="cell row mb-2" htmlFor="preload-check">
            <div className="col-md-4">Preload</div>
            <div className="col-md-8">
              <div className="custom-checkbox">
                <input
                  className="cell"
                  type="checkbox"
                  id="preload-check"
                  checked={preload}
                  onChange={({ target: { checked } }) => updateCampaign({ preload: checked })}
                />
                <span className="label" />
              </div>
            </div>
          </label>
        </div>
      </div>
      {embedLocation && (
        <div className="embed-details">
          {
            embedLocation.key === WORDPRESS
              ? (
                <span className="embed-line mb-2">
                  Click here to install the
                  <a href="https://cdn.vidcloud.io/wp/vr.zip">wp</a>
                  plugin.
                </span>
              )
              : null
          }
          <span className="embed-line">{embedLocation.prompt}</span>
          { embedLocation.key === DEFAULT ? null : (
            <EmbedDataContainer
              className="embed-item"
              url={project.url}
              stringGenerator={embedLocation.embedGenerator}
              resizable
              thumbnail={project.thumbnail || DEFAULT_THUMBNAIL}
              playCheckbox={settings.embedLocation.playCheckbox}
            />
          )}
        </div>
      )}
    </div>
  );
};

EmbedEngine.propTypes = {
  settings: PropTypes.shape({
    embedLocation: PropTypes.shape({
      key: PropTypes.string.isRequired,
      prompt: PropTypes.string,
      embedGenerator: PropTypes.func.isRequired,
      playCheckbox: PropTypes.bool,
    }),
    preload: PropTypes.bool,
  }).isRequired,
  updateCampaign: PropTypes.func.isRequired,
  project: PropTypes.shape({
    url: PropTypes.string.isRequired,
    thumbnail: PropTypes.string,
  }).isRequired,
};

export default EmbedEngine;
