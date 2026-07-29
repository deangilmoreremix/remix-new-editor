// Shallow stub for missing legacy timeline AI chat panel.
// The original implementation is dead code in this build configuration.
export default class AIChatPanel {
  constructor() {
    console.info('[AIChatPanel] Stub initialized; original panel is disabled.');
  }
  render() {
    return document.createElement('div');
  }
}
