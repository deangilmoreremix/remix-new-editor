import React, { useMemo } from 'react';
import { observer } from 'mobx-react';
import moment from 'moment';
import SVGInline from 'react-svg-inline';
import Link from 'next/link';

import HelpIconComponent from '../HelpIcon';

import PropTypes from '../../../lib/PropTypes';
import useModalStore from '../../hooks/useModalStore';

import { DEFAULT_THUMBNAIL } from '../../../lib/constants/project';
import { TEMPLATE_PREVIEW_MODAL, PROJECT_SETTINGS_MODAL } from '../../../lib/constants/modals';
import { templatesTooltips } from '../../../lib/constants/tooltips';
import { EDITOR_TYPES } from '../../../lib/constants/routing';

import editProjectIcon from '../../../public/static/svgImages/common/edit-project-icon.svg';
import openEditIcon from '../../../public/static/svgImages/projects/edit-project-icon.svg';
import previewProjectIcon from '../../../public/static/svgImages/projects/preview-project-icon.svg';
import remixProjectIcon from '../../../public/static/svgImages/projects/remix-project-icon.svg';

const TemplatesPreview = observer((props) => {
  const { item, updateItem, updateList, prefixes, whiteLabel } = props;

  const date = useMemo(() => (
    moment(item.createdAt).format('MM-DD-YYYY')
  ), [item.updatedAt]);

  const { openModal } = useModalStore();

  const editorLink = useMemo(() => {
    const project = `edit?project=${item.project?._id}`;
    switch (item.editor) {
      case EDITOR_TYPES.REVOLUTION:
        return project;
      case EDITOR_TYPES.GO:
        return `http://${prefixes.go}.${whiteLabel.domain}/${project}`;
      case EDITOR_TYPES.DEFAULT:
        return `http://${prefixes.editor}.${whiteLabel.domain}/en-US/editor/${item.project?._id}/edit`;
      default: break;
    }
  }, [item, item.editor]);

  return (
    <div className="projects-library__item library__item">
      <div className="library__item-image" style={{ backgroundImage: `url(${item.thumbnail || DEFAULT_THUMBNAIL})` }} />
      <div className="projects-item-buttons">
        <SVGInline
          className="projects-item-buttons__edit-icon"
          svg={editProjectIcon}
          onClick={() => openModal(PROJECT_SETTINGS_MODAL, { item, updateItem, updateList })}
        />
        <div className="projects-item-buttons__second">
          <HelpIconComponent noIcon message={templatesTooltips.previewButton}>
            <button
              className="projects-item-edit"
              onClick={() => openModal(TEMPLATE_PREVIEW_MODAL, { item, editorLink })}
            >
              <SVGInline
                className="projects-item-buttons__action-icon"
                svg={previewProjectIcon}
              />
            </button>
          </HelpIconComponent>
          <HelpIconComponent noIcon message={templatesTooltips.editProjectButton}>
            <div className="projects-item-edit">
              <Link href={editorLink || ''}>
                <SVGInline
                  className="projects-item-buttons__action-icon"
                  svg={openEditIcon}
                />
              </Link>
            </div>
          </HelpIconComponent>
          <HelpIconComponent noIcon message={templatesTooltips.remixProjectButton}>
            <div className="projects-item-edit">
              <Link href={`edit?remix=${item.project?._id}`}>
                <SVGInline
                  className="projects-item-buttons__action-icon"
                  svg={remixProjectIcon}
                />
              </Link>
            </div>
          </HelpIconComponent>
        </div>
      </div>
      <div className="library__item-information">
        <span>{item.title}</span>
        <span>{date}</span>
      </div>
    </div>
  );
});

TemplatesPreview.propTypes = {
  updateItem: PropTypes.func,
  updateList: PropTypes.func,
  item: PropTypes.shape({
    thumbnail: PropTypes.string,
  }).isRequired,
};

export default TemplatesPreview;
