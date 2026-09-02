export const fileReader = file => new Promise((resolve) => {
  const reader = new FileReader();
  reader.readAsText(file, 'UTF-8');
  reader.onload = (event) => resolve(event.target.result);
});
