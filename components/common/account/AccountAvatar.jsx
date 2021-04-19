import React, { memo, useState } from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import PropTypes from '../../../lib/PropTypes';

import DropAndEditButton from '../../media/DropAndEditButton';

import uploadAvatarIcon from '../../../public/static/svgImages/common/upload-avatar-icon.svg';

const AccountAvatar = memo(({ photo, hasPermissions, onUploadImage }) => {
  const [isDisabledUpload, setIsDisabledUpload] = useState(false);

  return (
    <div className="user-panel__avatar">
      {photo ? (
        <img src={photo} className="user-panel__avatar-custom" alt="user-avatar" />
      ) : (
        <label
          htmlFor="upload-file"
          className={classnames('user-panel__avatar-custom', { 'avatar-dark-theme': hasPermissions })}
        >
          <SVGInline
            className="user-panel__avatar-icon"
            svg={uploadAvatarIcon}
          />
        </label>
      )}
      <div className="text-center user-panel__avatar-hint">
        <span className="user-panel__avatar-span-hint">The recommended image is 300 by 300 pixels</span>
        <DropAndEditButton
          needSaveAsset={false}
          className="user-panel__avatar-upload"
          recommendedResolution={{ width: 300, height: 300 }}
          onUploaded={onUploadImage}
          isDisabled={isDisabledUpload}
          startUpload={() => setIsDisabledUpload(true)}
          endUpload={() => setIsDisabledUpload(false)}
        />
      </div>
    </div>
  );
});

AccountAvatar.propTypes = {
  photo: PropTypes.string.isRequired,
  hasPermissions: PropTypes.bool,
  onUploadImage: PropTypes.func.isRequired,
};

export default AccountAvatar;
