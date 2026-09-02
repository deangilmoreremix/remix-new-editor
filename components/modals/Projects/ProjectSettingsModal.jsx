import React, { memo, useReducer, useEffect } from 'react';
import SVGInline from 'react-svg-inline';
import PropTypes from '../../../lib/PropTypes';

import useBaseStore from '../../hooks/useBaseStore';

import List from '../../common/gallery/List';

import { initialState as listInitialState, reducer as listReducer } from '../../../lib/utils/reducers/listReducer';
import { ACTION_TYPES } from '../../../lib/constants/reducers/listReducer';
import { showConfirmation, showError, showSuccess } from '../../../lib/services/alertService';

import projectSettingsIcon from '../../../public/static/svgImages/projects/project-settings-modal-icon.svg';
import deleteProjectIcon from '../../../public/static/svgImages/projects/delete-project-icon.svg';

const ProjectSettingsModal = memo(({ handleClose, options }) => {
  const { item, updateItem, updateList } = options;

  const { sendRequest } = useBaseStore();

  const [foldersList, dispatchFoldersList] = useReducer(listReducer, listInitialState);

  useEffect(() => {
    dispatchFoldersList({
      type: ACTION_TYPES.SET_INITIAL,
      value: {
        // eslint-disable-next-line react/prop-types
        content: ({ item: folderItem }) => (
          <option
            // eslint-disable-next-line react/prop-types
            selected={item.folder === folderItem._id}
            value={folderItem._id}
          >
            {folderItem.title}
          </option>
        ),
        path: '/api/users/me/folders',
        perPage: 100,
        orderBy: { createdAt: -1 },
      },
    });
  }, []);

  const onSelectFolder = async ({ target }) => {
    const { value } = target;
    try {
      await sendRequest(
        'PATCH',
        `/api/makes/${item._id}`,
        { folder: value },
      );
      item.folder = value;
      updateItem(item);
      showSuccess('Folder is successfully set!');
    } catch (e) {
      showError(e.message);
    }
  };

  const onDeleteProject = async (isArchived) => {
    try {
      const confirm = await showConfirmation(
        `Are you sure you want to ${item.archived && !isArchived ? 'delete' : `${isArchived ? 'un' : ''}archive`} the project?`,
      );
      if (confirm) {
        await sendRequest(
          item.archived && !isArchived ? 'DELETE' : 'PATCH',
          `/api/users/me/makes/${item._id}${item.archived && !isArchived ? '' : '/archive'}`,
        );
        updateList();
        handleClose();
        showSuccess(
          `Project is successfully ${item.archived && !isArchived ? 'deleted' : `${isArchived ? 'un' : ''}archived`}!`,
        );
      }
    } catch (e) {
      showError(e.message);
    }
  };

  return (
    <div className="project-settings-modal__content">
      <div className="project-settings-modal__content-icon">
        <SVGInline
          className="project-settings-modal-icon"
          svg={projectSettingsIcon}
        />
      </div>
      <div className="project-settings-modal__content-data">
        <span>Add To Folder</span>
        <select disabled={item.archived} onChange={onSelectFolder}>
          <option selected disabled>Select your folder...</option>
          <List withoutParent list={foldersList} dispatchList={dispatchFoldersList} />
        </select>
        <div className="project-settings-modal__content-data__buttons-box">
          {item.archived && (
            <button className="unarchive-button" onClick={() => onDeleteProject(true)}>
              Unarchive
            </button>
          )}
          <button onClick={() => onDeleteProject(false)}>
            <SVGInline svg={deleteProjectIcon} />
            {item.archived ? 'Delete' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  );
});

ProjectSettingsModal.propTypes = {
  handleClose: PropTypes.func,
  options: PropTypes.shape({
    updateItem: PropTypes.func,
    updateList: PropTypes.func,
    item: PropTypes.shape({
      _id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      folder: PropTypes.string.isRequired,
      archived: PropTypes.bool.isRequired,
    }).isRequired,
  }),
};

export default ProjectSettingsModal;
