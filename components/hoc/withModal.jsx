import * as React from 'react';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap';

const withModal = (WrappedComponent) => (props) => {
  const [modal, setModal] = React.useState(null);

  const isOpen = React.useMemo(() => Boolean(modal), [modal]);

  const hide = React.useCallback((callback) => {
    setModal(null);
    if (typeof callback === 'function') {
      callback();
    }
  }, []);

  const show = (modalContent, callback) => {
    setModal(modalContent);
    if (typeof callback === 'function') {
      callback();
    }
  };

  const { title, header, body, footer } = modal || {};

  return (
    <React.Fragment>
      <WrappedComponent {...props} closeModal={hide} openModal={show} />
      {modal && (
        <Modal isOpen={isOpen} toggle={hide}>
          {header && <ModalHeader>{title}</ModalHeader>}
          {body && <ModalBody>{body}</ModalBody>}
          <ModalFooter>
            {footer}
            <Button color="secondary" onClick={hide}>Cancel</Button>
          </ModalFooter>
        </Modal>
      )}
    </React.Fragment>
  );
};

export default withModal;
