import React, { Fragment, useState } from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import useProjectStore from '../hooks/useProjectStore';
import useModalStore from '../hooks/useModalStore';
import useUserStore from '../hooks/useUserStore';

import PropTypes from '../../lib/PropTypes';
import * as VALIDATORS from '../../lib/validators';
import { URL_RULE } from '../../lib/constants/regExps';
import { TYPES } from '../../lib/constants/validator';
import { MEDIA_TYPES } from '../../lib/constants/popcorn';
import { ASSET_TYPES } from '../../lib/constants/media';
import { URL_VIDEO_MODAL } from '../../lib/constants/modals';

import { LibrarySpinner } from '../media/Loader';
import withValidation from '../hoc/withValidation';

import linkIcon from '../../public/static/svgImages/link.svg';
import socialImg from '../../public/static/svgImages/social-link-image.svg';

const UrlVideoModal = ({ setError }) => {
  const [currentValue, setCurrentValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { addElement } = useProjectStore();
  const { closeModal } = useModalStore();
  const { downloaderEnabled } = useUserStore();

  const onSelect = async (item) => {
    if (isLoading) {
      return;
    }
    item.src = item.src || item.url;
    item.type = MEDIA_TYPES.VIDEO;
    item.kind = ASSET_TYPES.VIDEO;

    setIsLoading(true);
    try {
      await addElement(item);
      closeModal(URL_VIDEO_MODAL);
    } catch (e) {
      if (setError) {
        setError(e.message);
      }
      setIsLoading(false);
    }
  };

  const onEnter = (url) => {
    if (url && !URL_RULE.test(url)) {
      url = `${window.location.protocol}//${url}`;
    }
    const err = VALIDATORS.default[TYPES.URL]({ value: url });
    if (!err) {
      return onSelect({ url });
    }
  };

  const onChange = ({ target: { value: v } }) => {
    setCurrentValue(v);
  };

  const onClick = () => {
    onEnter(currentValue);
  };

  const returnLink = () => (
    <a
      href="https://smartdownloader.vidcloud.io/"
      className="library__block--title"
      target="_blank"
      rel="noopener noreferrer"
    >
      Download Video
    </a>
  );

  return (
    <Fragment>
      <SVGInline
        className="url-video-modal__image"
        svg={socialImg}
      />
      <p className="url-video-modal__title">
        Add your URL
        &nbsp;
        {downloaderEnabled && 'or'}
        &nbsp;
        {downloaderEnabled && returnLink()}
      </p>
      <div className="url-video-modal__block">
        <div className="url-video-modal__input-block">
          <SVGInline
            className="url-video-modal__icon"
            svg={linkIcon}
          />
          <input
            type="text"
            value={currentValue}
            onChange={onChange}
            className="url-video-modal__input"
            placeholder="Paste the URL to external video hosting (Youtube, Vimeo, etc)"
          />
        </div>
        <button
          onClick={onClick}
          className={classnames('url-video-modal__btn', { 'url-video-modal__btn-disabled': !currentValue })}
          disabled={!currentValue}
        >
          {isLoading ? <LibrarySpinner /> : 'Add to timeline'}
        </button>
      </div>
    </Fragment>
  );
};

UrlVideoModal.propTypes = {
  setError: PropTypes.func.isRequired,
};

export default withValidation(UrlVideoModal);
