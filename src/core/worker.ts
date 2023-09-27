self.addEventListener('message', (ev) => {
  const view = new Uint8Array(ev.data);
  view[0] = 1;
  self.postMessage(ev.data);
});
