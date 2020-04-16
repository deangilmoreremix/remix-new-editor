import ProjectStore from './project.store';

export default class PresetStore extends ProjectStore {
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
}
