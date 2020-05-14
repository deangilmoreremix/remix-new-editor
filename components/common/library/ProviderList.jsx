import React from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';
import { USER_ITEMS } from '../../../lib/constants/library';

const ProviderList = (props) => {
  const {
    list,
    activeItem,
    title,
    userContentTitle,
    handleButtonClick,
  } = props;

  return (
    <div className="library__block">
      <p className="library__block--title">{title}</p>
      <div className="library__btn-container">
        {
          list && Object.keys(list).map(element => (
            <button
              type="button"
              key={list[element].name}
              className={classnames(
                'library__btn-item',
                {
                  'library__btn-active': activeItem === element,
                  'library__btn-user': element === USER_ITEMS,
                },
              )}
              onClick={() => handleButtonClick(element)}
            >
              {list[element].icon && (
                <SVGInline
                  className="library__icon-btn"
                  svg={list[element].icon}
                  cleanup={[list[element].name]}
                />
              )}
              <p>
                {element === USER_ITEMS ? `${list[element].name} ${userContentTitle}` : list[element].name}
              </p>
            </button>
          ))
        }
      </div>
    </div>
  );
};

ProviderList.propTypes = {
  list: PropTypes.shape({}).isRequired,
  activeItem: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  userContentTitle: PropTypes.string.isRequired,
  handleButtonClick: PropTypes.func.isRequired,
};

export default ProviderList;
