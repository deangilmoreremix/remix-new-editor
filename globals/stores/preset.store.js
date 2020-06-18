import { action, reaction } from 'mobx';
import ProjectStore from './project.store';

export default class PresetStore extends ProjectStore {
  constructor(props) {
    super(props, false);
    reaction(
      () => this.popcorn,
      () => {
        if (!this.popcorn.on) {
          return;
        }

        this.popcorn.on('ended', () => {
          this.time = 0;
          this.updateTime(0);
        });

        this.popcorn.on('play', () => {
          this.isPlayed = true;
        });
      },
    );
  }

  save = async (type, url, name) => {
    try {
      const data = await this.request(
        '/api/presets',
        {
          method: 'POST',
          headers: {
            'on-behalf': this.currentUser.id,
          },
          body: {
            data: JSON.stringify(this.projectData),
            type,
            url,
            name,
          },
        });
      return data;
    } catch (e) {
      throw new Error(e.message);
    }
  };

  @action
  setPreviewData = (data) => {
    this.setProjectData(JSON.parse(data));
  };

  @action
  destroyPopcorn = () => {
    this.isPlayed = false;
    if (this.popcorn && this.popcorn.target) {
      window.Popcorn.destroy(this.popcorn);
    }
  };

  @action
  playPreset = () => {
    this.isLoaded = true;
    this.playPause();
  };
}
