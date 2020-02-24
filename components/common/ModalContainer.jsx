import * as React from 'react';
import { observer } from 'mobx-react';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap';

import useModalStore from '../hooks/useModalStore';

const ModalContainer = observer(() => {
  const modalStore = useModalStore();
  const { modalIds, modals, closeModal, updateTitle } = modalStore;

  const modalsToShow = modals.filter(m => modalIds.has(m.id));

  return modalsToShow.map(({ id, className, renderer: ModalComponent, title }) => {
    const close = () => closeModal(id);

    const updateModalTitle = (newTitle) => updateTitle(id, newTitle);

    return (
      <Modal key={id} isOpen toggle={close} className={className}>
        <ModalHeader toggle={close}>{title}</ModalHeader>
        <ModalBody>
          <ModalComponent
            handleClose={close}
            updateTitle={updateModalTitle}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={close}>Cancel</Button>
        </ModalFooter>
      </Modal>
    );
  });
});

export default ModalContainer;
