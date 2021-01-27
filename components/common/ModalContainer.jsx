import * as React from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';

import useModalStore from '../hooks/useModalStore';
import useUserStore from '../hooks/useUserStore';

import SettingsHeader from '../settings/SettingsHeader';

const ModalContainer = observer(({ classNameWL }) => {
  const modalStore = useModalStore();
  const {
    modalIds,
    modals,
    closeModal,
    updateHeader,
    updateClassName,
    updateMaxWidth,
    options,
  } = modalStore;
  const { hasPermissions } = useUserStore();

  const modalsToShow = modals.filter(m => modalIds.has(m.id));

  return modalsToShow.map(({
    id,
    className,
    maxWidth,
    renderer: ModalComponent,
    header: headerProps,
    ...props
  }) => {
    const { themeChange } = props;

    const close = () => {
      if (headerProps && headerProps.onClose) {
        headerProps.onClose();
      }
      closeModal(id);
    };

    const updateModalHeader = (newHeaderProps) => updateHeader(id, newHeaderProps);
    const updateModalClassName = (newHeaderProps) => updateClassName(id, newHeaderProps);
    const updateModalMaxWidth = (newWidthProps) => updateMaxWidth(id, newWidthProps);

    return (
      <Dialog
        key={id}
        fullWidth={false}
        maxWidth={maxWidth || 'sm'}
        open
        onClose={close}
        aria-labelledby="max-width-dialog-title"
        className={classnames(classNameWL, 'modal-container')}
        {...props}
      >
        <SettingsHeader {...headerProps} />
        <DialogContent
          className={
            classnames(
              'modal-container__content',
              themeChange && !hasPermissions ? `${className}-white` : className,
            )
          }
        >
          <ModalComponent
            options={options}
            handleClose={close}
            setHeader={updateModalHeader}
            setClassName={updateModalClassName}
            setMaxWidth={updateModalMaxWidth}
          />
        </DialogContent>
      </Dialog>
    );
  });
});

export default ModalContainer;
