import { observable } from 'mobx';
import { generatePopcornObject } from '../../lib/utils/popcorn-helper';

export default class PopcornStore {
  @observable popcorn;

  start = () => {
    this.popcorn.currentTime(0);
    this.popcorn.play();
  };

  setPopcorn = (popcornObject, target) => {
    this.destroy();
    this.popcorn = window.Popcorn.smart(target,
      popcornObject.mediaUrlsString, popcornObject.mediaPopcornOptions);
    this.popcorn.on('ended', this.start);
    this.attach(popcornObject, target);
  };

  attach = (popcornObject, target) => {
    popcornObject.elements.forEach((element) => this.popcorn[element.type](target
      ? { ...element.popcornOptions, target }
      : element.popcornOptions));
    this.popcorn.target = target;
    return this.popcorn;
  };


setData = (item, target) => {
  const projectData = JSON.parse(item.project.data);
  const popcornObject = generatePopcornObject(projectData);
  this.setPopcorn(popcornObject, target);
}

destroy = () => {
  if (this.popcorn && this.popcorn.target) {
    this.popcorn.off('ended', this.start);
    if (window.Popcorn.destroy) {
      window.Popcorn.destroy(this.popcorn);
    }
    this.popcorn = null;
  }
};

play = () => {
  if (this.popcorn) {
    this.popcorn.play();
  }
}
}
