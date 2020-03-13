((Popcorn) => {
  /* Detect if we're in editor */
  if (typeof (window.Butter) === 'undefined') {
    return false;
  }

  Popcorn.plugin('combined', {
    manifest: {
      about: {
        name: 'Popcorn CombinedEvents Plugin',
        version: '0.3',
        author: 'aecepoglu',
      },
      options: {},
    },
    _setup() {
    },
    start() {
    },
    end() {
    },
    frame() {
    },
    _teardown() {
    },
  });
})(window.Popcorn);
