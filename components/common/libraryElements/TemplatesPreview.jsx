import React, { useMemo } from 'react';
import Link from 'next/link';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';

import HelpIconComponent from '../HelpIcon';

import { DEFAULT_THUMBNAIL } from '../../../lib/constants/project';
import { TEMPLATE_PREVIEW_MODAL } from '../../../lib/constants/modals';
import { templatesTooltips } from '../../../lib/constants/tooltips';
import { EDITOR_TYPES } from '../../../lib/constants/routing';

import useUserStore from '../../hooks/useUserStore';
import useModalStore from '../../hooks/useModalStore';

const TemplatesPreview = observer((props) => {
  const { item, prefixes, whiteLabel } = props;

  const { hasPermissions, editorEnabled } = useUserStore();
  const { openModal } = useModalStore();

  const editorLink = useMemo(() => {
    const project = `edit?project=${item.project._id}`;
    switch (item.editor) {
      case EDITOR_TYPES.REVOLUTION:
        return project;
      case EDITOR_TYPES.GO:
        return `http://${prefixes.go}.${whiteLabel.domain}/${project}`;
      case EDITOR_TYPES.DEFAULT:
        return `http://${prefixes.editor}.${whiteLabel.domain}/en-US/editor/${item.project._id}/edit`;
      default: break;
    }
  }, [item, item.editor]);

  return (
    <div className="library__item">
      <div className="library__item-image" style={{ backgroundImage: `url(${item.thumbnail || DEFAULT_THUMBNAIL})` }} />
      <div className="library__item-buttons">
        <button
          className="library__item-button"
          onClick={() => openModal(TEMPLATE_PREVIEW_MODAL, { item, editorLink })}
        >
          Preview
        </button>
        {hasPermissions && (
          <HelpIconComponent noIcon message={templatesTooltips.editButton}>
            <button className="library__item-button">Edit</button>
          </HelpIconComponent>
        )}
        {editorEnabled && (
          <HelpIconComponent noIcon message={templatesTooltips.remixCopyButton}>
            <div className="library__item-button">
              <Link
                href={`edit?remix=${item.project._id}`}
              >
                Remix / Copy
              </Link>
            </div>
          </HelpIconComponent>
        )}
      </div>
      <div className="library__item-information">
        <span>{item.title}</span>
      </div>
    </div>
  );
});

TemplatesPreview.propTypes = {
  item: PropTypes.shape({
    thumbnail: PropTypes.string,
    project: PropTypes.shape({
      _id: PropTypes.string,
    }),
  }).isRequired,
};

export default TemplatesPreview;
