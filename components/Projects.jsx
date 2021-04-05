import React, { useCallback, useEffect } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import { useRouter } from 'next/router';

import { initialState as listInitialState, reducer as listReducer } from '../lib/utils/reducers/listReducer';

import { ACTION_TYPES } from '../lib/constants/reducers/listReducer';
import { FOLDER_MODAL } from '../lib/constants/modals';
import { showSuccess, showConfirmation } from '../lib/services/alertService';

import useUserStore from './hooks/useUserStore';
import useModalStore from './hooks/useModalStore';
import useBaseStore from './hooks/useBaseStore';
import useSearchStore from './hooks/useSearchStore';
import useCommonStore from './hooks/useCommonStore';

import ProjectsPreview from './common/libraryElements/ProjectsPreview';
import List from './common/gallery/List';
import Folders from './common/Folders';
import Folder from './common/libraryElements/Folder';

const ARCHIVED = 'archived';

const Projects = observer(() => {
  const { hasPermissions } = useUserStore();
  const { openModal } = useModalStore();
  const { sendRequest } = useBaseStore();
  const { prefixes, whiteLabelManager } = useCommonStore();

  const router = useRouter();

  const [list, dispatchList] = React.useReducer(listReducer, listInitialState);
  const [foldersList, dispatchFoldersList] = React.useReducer(listReducer, listInitialState);
  const { q, reset: resetSearch } = useSearchStore();

  useEffect(() => {
    updateFolders();
    resetSearch();
  }, []);

  useEffect(() => {
    if (foldersList.init) {
      updateList(true);
    }
  }, [foldersList.init]);

  useEffect(() => {
    if (foldersList.items.length > 0 && router.query.folder) {
      selectFolder(router.query.folder);
    }
  }, [foldersList.items]);

  useEffect(() => {
    if (foldersList.init) {
      if (!foldersList.activeItem) {
        selectFolder();
      }
      updateList();
    }
  }, [foldersList.activeItem]);

  useEffect(() => dispatchList({
    type: ACTION_TYPES.SET_QUERY,
    value: q,
  }), [q]);

  const updateList = (isInit = false) => {
    if (router.query.folder && isInit) {
      return;
    }

    dispatchList({
      type: ACTION_TYPES.SET_INITIAL,
      value: {
        path: '/api/users/me/makes',
        content: (props) => (
          <ProjectsPreview
            prefixes={prefixes}
            whiteLabel={whiteLabelManager}
            updateItem={updateCurrentProject}
            updateList={updateList}
            {...props}
          />
        ),
        perPage: 20,
        filter: {
          folder: foldersList.activeItem && foldersList.activeItem._id,
          archived: foldersList.activeItem === ARCHIVED ? { $in: true } : { $in: [null, false] },
        },
        orderBy: { createdAt: -1 },
      },
    });
  };

  const updateCurrentProject = (item) => {
    dispatchList({
      type: ACTION_TYPES.UPDATE_ITEM,
      value: item || null,
    });
  };

  const selectFolder = useCallback((item) => {
    if (item || item === ARCHIVED) {
      router.push({
        query: { folder: item === ARCHIVED ? ARCHIVED : item.title || item },
      });
    } else {
      router.push('/projects');
    }
    dispatchFoldersList({
      type: ACTION_TYPES.SET_ACTIVE_ITEM,
      value: item || null,
    });
  }, []);

  const onDeleteFolder = async (item) => {
    const response = await showConfirmation(
      'Are you sure you want to delete the folder? All projects here in will be deleted as well.',
      `Delete "${item.title}" folder`,
    );

    if (response) {
      await sendRequest(
        'DELETE',
        `/api/users/me/folders/${item._id}`,
      );
      updateFolders();
      showSuccess(`Folder "${item.title}" is successfully deleted!`);
    }
  };

  const updateFolders = () => {
    dispatchFoldersList({
      type: ACTION_TYPES.SET_INITIAL,
      value: {
        path: '/api/users/me/folders',
        content: (props) => (
          <Folder
            onClick={selectFolder}
            onDelete={onDeleteFolder}
            onEdit={onEditFolder}
            {...props}
          />
        ),
        perPage: 25,
        orderBy: { createdAt: -1 },
      },
    });
  };

  const updateFolder = (folder) => {
    dispatchFoldersList({
      type: ACTION_TYPES.UPDATE_ITEM,
      value: folder,
    });
  };

  const createFolder = (folder) => {
    dispatchFoldersList({
      type: ACTION_TYPES.ADD_ITEM,
      value: folder,
    });
  };

  const onEditFolder = (item) => {
    openModal(FOLDER_MODAL, { item, updateFolder });
  };

  return (
    <div className={classnames('projects', { 'dark-theme': hasPermissions })}>
      <Folders
        list={foldersList}
        dispatchList={dispatchFoldersList}
        select={selectFolder}
        className="categories"
        createFolder={createFolder}
      />
      <div className="list">
        <List
          list={list}
          dispatchList={dispatchList}
          className="library__body"
          contentClassName="library__items"
        />
      </div>
      <div className="library__gradient only-content" />
    </div>
  );
});

export default Projects;
