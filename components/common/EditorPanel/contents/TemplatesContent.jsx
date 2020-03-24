import React from 'react';
import SVGInline from 'react-svg-inline';
import star from '../../../../public/static/images/star.svg';

const Templates = () => (
  <div className="panel-content__body">
    <div className="panel-content">
      <div className="panel-content__block">
        <div className="panel-content__row">
          <p className="panel-content__title">Recently Used</p>
          <button type="button" className="panel-content__button">See all</button>
        </div>

        <div className="panel-content__row">
          <button className="panel-content__img">
            <SVGInline
              className="panel-content-star"
              svg={star}
              alt=""
            />
          </button>
          <button className="panel-content__img">
            <SVGInline
              className="panel-content-star"
              svg={star}
              alt=""
            />
          </button>
        </div>
      </div>

      <div className="panel-content__block">
        <div className="panel-content__row">
          <p className="panel-content__title">Food Thumbnail</p>
          <button type="button" className="panel-content__button">See all</button>
        </div>

        <div className="panel-content__row">
          <button className="panel-content__img">
            <SVGInline
              className="panel-content-star"
              svg={star}
              alt=""
            />
          </button>
          <button className="panel-content__img">
            <SVGInline
              className="panel-content-star"
              svg={star}
              alt=""
            />
          </button>
        </div>
      </div>

      <div className="panel-content__block">
        <div className="panel-content__row">
          <p className="panel-content__title">Beauty Thumbnail</p>
          <button type="button" className="panel-content__button">See all</button>
        </div>

        <div className="panel-content__row">
          <button className="panel-content__img">
            <SVGInline
              className="panel-content-star"
              svg={star}
              alt=""
            />
          </button>
          <button className="panel-content__img">
            <SVGInline
              className="panel-content-star"
              svg={star}
              alt=""
            />
          </button>
        </div>
      </div>

      <div className="panel-content__block">
        <div className="panel-content__row">
          <p className="panel-content__title">Cars Thumbnail</p>
          <button type="button" className="panel-content__button">See all</button>
        </div>

        <div className="panel-content__row">
          <button className="panel-content__img">
            <SVGInline
              className="panel-content-star"
              svg={star}
              alt=""
            />
          </button>
          <button className="panel-content__img">
            <SVGInline
              className="panel-content-star"
              svg={star}
              alt=""
            />
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default Templates;
