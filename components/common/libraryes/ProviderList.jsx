import React from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

const ProviderList = ({ activeItem, onSelectItem, items, title, userContentTitle }) => (
  <div className="library__block">
    <p>{title}</p>
    <div className="library__btns">
      {
        items && Object.keys(items).map(element => (
          <button
            type="button"
            key={items[element].name}
            className={classnames(
              'library__btn',
              { 'library__btn-active': activeItem === element },
              { 'library__btn-user': element === 'USER' },
            )}
            onClick={() => onSelectItem(element)}
          >
            {items[element].icon && (
              <SVGInline
                className="library__icon-btn"
                svg={items[element].icon}
              />
            )}
            <p>
              {element === 'USER' ? `${items[element].name} ${userContentTitle}` : items[element].name}
            </p>
          </button>
        ))
      }
    </div>
  </div>
);

ProviderList.propTypes = {
  activeItem: PropTypes.string,
  onSelectItem: PropTypes.func.isRequired,
  items: PropTypes.objectOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      icon: PropTypes.string,
    }),
  ),
  title: PropTypes.string.isRequired,
  userContentTitle: PropTypes.string.isRequired,
};

export default ProviderList;
