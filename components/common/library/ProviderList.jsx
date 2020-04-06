import React from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';
import { libraryProviders } from '../../../lib/constants/library';

const ProviderList = (props) => {
  const {
    activeItem,
    title,
    userContentTitle,
    handleButtonClick,
  } = props;

  return (
    <div className="library__block">
      <p>{title}</p>
      <div className="library__btn-container">
        {
          libraryProviders && Object.keys(libraryProviders).map(element => (
            <button
              type="button"
              key={libraryProviders[element].name}
              className={classnames(
                'library__btn-item',
                { 'library__btn-active': activeItem === element },
                { 'library__btn-user': element === Object.keys(libraryProviders)[0] },
              )}
              onClick={() => handleButtonClick(element)}
            >
              {libraryProviders[element].icon && (
                <SVGInline
                  className="library__icon-btn"
                  svg={libraryProviders[element].icon}
                />
              )}
              <p>
                {element === Object.keys(libraryProviders)[0] ? `${libraryProviders[element].name} ${userContentTitle}` : libraryProviders[element].name}
              </p>
            </button>
          ))
        }
      </div>
    </div>
  );
};

ProviderList.propTypes = {
  activeItem: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  userContentTitle: PropTypes.string.isRequired,
  handleButtonClick: PropTypes.func.isRequired,
};

export default ProviderList;
