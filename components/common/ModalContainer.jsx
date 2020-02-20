import * as React from 'react';
import { observer } from 'mobx-react';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap';

import useModalStore from '../hooks/useModalStore';

const ModalContainer = observer(() => {
  const modalStore = useModalStore();
  const { modalIds, modals, closeModal } = modalStore;

  const modalsToShow = modals.filter(m => modalIds.includes(m.id));

  return modalsToShow.map(({ id, className, renderer: ModalComponent, title }) => {
    const close = () => closeModal(id);

    return (
      <Modal key={id} isOpen toggle={close} className={className}>
        <ModalHeader toggle={close}>{title}</ModalHeader>
        <ModalBody>
          <ModalComponent />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={close}>Cancel</Button>
        </ModalFooter>
      </Modal>
    );
  });
});

export default ModalContainer;
