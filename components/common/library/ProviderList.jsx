import React from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';
import { libraryProviders } from '../../../lib/constants/library';

const ProviderList = (props) => {
  const {
    activeItem,
    items,
    title,
    userContentTitle,
    handleButtonClick,
  } = props;

  return (
    <div className="library__block">
      <p>{title}</p>
      <div className="library__btn-container">
        {
          items && Object.keys(items).map(element => (
            <button
              type="button"
              key={items[element].name}
              className={classnames(
                'library__btn-item',
                { 'library__btn-active': activeItem === element },
                { 'library__btn-user': element === Object.keys(libraryProviders)[0] },
              )}
              onClick={() => handleButtonClick(element)}
            >
              {items[element].icon && (
                <SVGInline
                  className="library__icon-btn"
                  svg={items[element].icon}
                />
              )}
              <p>
                {element === Object.keys(libraryProviders)[0] ? `${items[element].name} ${userContentTitle}` : items[element].name}
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
  items: PropTypes.objectOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      icon: PropTypes.string,
    }),
  ),
  title: PropTypes.string.isRequired,
  userContentTitle: PropTypes.string.isRequired,
  handleButtonClick: PropTypes.func.isRequired,
};

export default ProviderList;
