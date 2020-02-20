import * as React from 'react';
// import { observer } from 'mobx-react';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap';

import PropTypes from '../../lib/PropTypes';
import useModalStore from '../hooks/useModalStore';

const ModalContainer = () => {
  // TODO: connect to modal.store
  const modalStore = useModalStore();
  console.log(modalStore);

  modalStore && console.log(modalStore.modalIds);

  if (!modalStore || !modalStore.modals) return null;

  return modalStore.modals.map(({ id, className, renderer: ModalComponent, title }) => {
    const close = () => modalStore.closeModal(id);
    console.log('rendering modal ', id);
    const isOpen = Array.from(modalStore.modalIds).includes(id);

    console.log(isOpen);

    return (
      <Modal isOpen={isOpen} toggle={close} className={className}>
        <ModalHeader toggle={close}>{title}</ModalHeader>
        <ModalBody>
          {ModalComponent}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={close}>Cancel</Button>
        </ModalFooter>
      </Modal>
    );
  });
};

ModalContainer.propTypes = {
  className: PropTypes.string,
};

export default ModalContainer;
