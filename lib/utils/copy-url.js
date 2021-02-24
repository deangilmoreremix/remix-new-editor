export const copyPlaybackLink = (url) => {
  const tempNode = document.createElement('input');
  tempNode.value = url;
  document.body.appendChild(tempNode);
  tempNode.select();
  document.execCommand('copy');
  document.body.removeChild(tempNode);
};
