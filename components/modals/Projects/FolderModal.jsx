import React, { Fragment, memo, useState, useEffect } from 'react';
import SVGInline from 'react-svg-inline';
import PropTypes from '../../../lib/PropTypes';

import useBaseStore from '../../hooks/useBaseStore';

import { showError, showSuccess } from '../../../lib/services/alertService';

import folderIcon from '../../../public/static/svgImages/projects/modal-folder-icon.svg';

const FolderModal = memo(({ handleClose, options }) => {
  const { sendRequest } = useBaseStore();
  const { updateFolder, createFolder, item } = options;

  const [folderName, setFolderName] = useState(item?.title || '');
  const [disabledButton, setDisabledButton] = useState(true);

  useEffect(() => {
    setDisabledButton(folderName === '');
  }, [folderName]);

  const onChangeFolderName = ({ target }) => {
    const { value } = target;
    setFolderName(value);
  };

  const onCreateFolder = async () => {
    if (item) {
      try {
        const response = await sendRequest(
          'PATCH',
          `/api/users/me/folders/${item._id}`,
          { title: folderName },
        );
        await updateFolder(response);
        showSuccess(`Folder "${item.title}" is successfully renamed to "${response.title}"!`);
      } catch (e) {
        showError(`Error: ${e.toString()}`);
      }
    } else {
      try {
        const response = await sendRequest(
          'POST',
          '/api/users/me/folders',
          { title: folderName },
        );
        createFolder(response);
        showSuccess(`Folder "${response.title}" is successfully created!`);
      } catch (e) {
        showError(`Error: ${e.toString}`);
      }
    }
    handleClose();
  };

  return (
    <Fragment>
      <div className="add-folder-modal__content">
        <div className="add-folder-modal__content-icon">
          <SVGInline
            className="add-folder-modal-icon"
            svg={folderIcon}
          />
        </div>
        <div className="add-folder-modal__content-data">
          <span>Name Folder</span>
          <input
            type="text"
            value={folderName}
            onChange={onChangeFolderName}
            maxLength={20}
          />
          <div className="add-folder-modal__content-data__buttons-box">
            <button disabled={disabledButton} onClick={onCreateFolder}>OK</button>
            <button onClick={handleClose}>Cancel</button>
          </div>
        </div>
      </div>
    </Fragment>
  );
});

FolderModal.propTypes = {
  handleClose: PropTypes.func.isRequired,
  options: PropTypes.shape({
    updateFolder: PropTypes.func,
    createFolder: PropTypes.func,
    item: PropTypes.shape({
      _id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
    }),
  }).isRequired,
};

export default FolderModal;
