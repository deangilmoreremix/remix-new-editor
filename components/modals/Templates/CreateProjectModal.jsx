import React, { Fragment, memo } from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import PropTypes from '../../../lib/PropTypes';
import useUserStore from '../../hooks/useUserStore';

const CreateProjectModal = memo(({ options }) => {
  const { items } = options;
  const { hasPermissions } = useUserStore();

  return (
    <Fragment>
      <span
        className={
          classnames('create-project-modal__title', { 'create-project-modal__title-white': !hasPermissions })
        }
      >
        Create a New project
      </span>
      <div className="create-project-modal__box">
        {items && items.map((item) => (
          <a
            href={item.url}
            key={`item-${item.title}`}
            className={
              classnames('create-project-modal__item', { 'create-project-modal__item-white': !hasPermissions })
            }
          >
            <SVGInline
              className="create-project-modal__icon"
              svg={item.icon}
              component="div"
            />
            <span>Start from scratch</span>
            <span className="create-project-modal__url">{item.title}</span>
          </a>
        ))}
      </div>
    </Fragment>
  );
});

CreateProjectModal.propTypes = {
  options: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.shape({
      title: PropTypes.string.isRequired,
      svgIcon: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired,
    })).isRequired,
  }),
};

export default CreateProjectModal;
