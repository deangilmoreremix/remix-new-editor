import * as React from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';

import useModalStore from '../hooks/useModalStore';
import SettingsHeader from '../settings/SettingsHeader';

const ModalContainer = observer(() => {
  const modalStore = useModalStore();
  const { modalIds, modals, closeModal, updateHeader, updateClassName, options } = modalStore;

  const modalsToShow = modals.filter(m => modalIds.has(m.id));

  return modalsToShow.map(({
    id,
    className,
    renderer: ModalComponent,
    header: headerProps,
    ...props
  }) => {
    const close = () => {
      if (headerProps && headerProps.onClose) {
        headerProps.onClose();
      }
      closeModal(id);
    };

    const updateModalHeader = (newHeaderProps) => updateHeader(id, newHeaderProps);

    const updateModalClassName = (newHeaderProps) => updateClassName(id, newHeaderProps);

    return (
      <Dialog
        key={id}
        fullWidth={false}
        // maxWidth={maxWidth}
        open
        onClose={close}
        aria-labelledby="max-width-dialog-title"
        className="modal-container"
        {...props}
      >
        <SettingsHeader {...headerProps} />
        <DialogContent className={classnames('modal-container__content', className)}>
          <ModalComponent
            options={options}
            handleClose={close}
            setHeader={updateModalHeader}
            setClassName={updateModalClassName}
          />
        </DialogContent>
      </Dialog>
    );
  });
});

export default ModalContainer;
