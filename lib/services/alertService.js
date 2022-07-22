const sweetAlert = (typeof window !== 'undefined' && typeof document !== 'undefined')
  ? require('sweetalert')
  : async () => {};

const closeFn = () => {
  sweetAlert.stopLoading();
  sweetAlert.close();
};

export function closeAlert() {
  if (sweetAlert.getState().isOpen) {
    closeFn();
  } else {
    setTimeout(closeFn);
  }
}
export function showError(text) {
  return sweetAlert({
    title: 'Error',
    text,
    icon: 'error',
    buttons: true
  });
}


export function showProjectLimitError() {
  swal({
    text: "Project limit exceeded",
    icon: "warning",
    buttons: {
      cancel: {
        text: "Cancel",
        value: null,
        visible: false,
        className: "",
        closeModal: true,
        CSS:{
          "text-align": "center"
        }
      },
      confirm: {
        text: "Upgrade",
        value: true,
        visible: true,
        className: "swal-button",
        closeModal: true,
      }
    },
    dangerMode: true,
  })
  .then((willUpgrade) => {
    if (willUpgrade) {
      window.open('https://videoremix.io/project-pricing/', '_blank');
    }
  });
}

export function showSuccess(text, title) {
  return sweetAlert({ title, text, icon: 'success' });
}

export function showInfo(text, title = 'Info', icon = 'info') {
  return sweetAlert({ title, text, icon });
}

export function showProgress(text = 'Working...', title = 'Info') {
  return sweetAlert({
    title,
    text,
    buttons: false,
    closeOnClickOutside: false,
    closeOnEsc: false,
    icon: 'info',
  });
}

export function showConfirmation(text, title) {
  return sweetAlert({
    title: title ?? 'Are you sure?',
    text,
    icon: 'warning',
    buttons: true,
    dangerMode: true,
  });
}

export function promptString(text, buttonText = 'Ok') {
  return sweetAlert({
    text,
    content: 'input',
    button: {
      text: buttonText,
      closeModal: true,
    },
  });
}

export default {
  closeAlert,
  promptString,
  showConfirmation,
  showSuccess,
  showError,
  showInfo,
  showProgress,
  showProjectLimitError
};
