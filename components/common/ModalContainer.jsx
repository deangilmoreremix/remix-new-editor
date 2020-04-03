import * as React from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';
import { makeStyles } from '@material-ui/core/styles';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';

import useModalStore from '../hooks/useModalStore';
import SettingsHeader from '../settings/SettingsHeader';
import { COLORS } from '../../lib/constants/styles';

const useStyles = makeStyles({
  root: {
    background: COLORS.darkTwinlight,
    color: COLORS.white,
  },
  modalContainer: {
    top: 0,
  },
});

const ModalContainer = observer(() => {
  const classes = useStyles();
  const modalStore = useModalStore();
  const { modalIds, modals, closeModal, updateHeader, options } = modalStore;

  const modalsToShow = modals.filter(m => modalIds.has(m.id));

  return modalsToShow.map(({
    id,
    className,
    renderer: ModalComponent,
    header: headerProps,
  }) => {
    const close = () => {
      if (headerProps && headerProps.onClose) {
        headerProps.onClose();
      }
      closeModal(id);
    };

    const updateModalHeader = (newHeaderProps) => updateHeader(id, newHeaderProps);

    return (
      <Dialog
        key={id}
        fullWidth={false}
        // maxWidth={maxWidth}
        open
        onClose={close}
        aria-labelledby="max-width-dialog-title"
        className={classes.modalContainer}
      >
        <SettingsHeader {...headerProps} />
        <DialogContent className={classnames(classes.root, className)}>
          <ModalComponent
            options={options}
            handleClose={close}
            setHeader={updateModalHeader}
          />
        </DialogContent>
      </Dialog>
    );
  });
});

export default ModalContainer;
