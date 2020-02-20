/**
 * Created by Eugene Butusov on 06/11/2018.
 */

import React from 'react';

import PropTypes from '../../../lib/PropTypes';

const LinkedinPostPreview = (props) => {
  const {
    user,
    post: { title, thumbnail, description },
  } = props;
  const { name, userpic, headline } = user || {};

  return (
    <div className="postPreview">
      <div id="DIV_1">
        <div id="DIV_2">
          <artdeco id="ARTDECO-DROPDOWN_3">
            <artdeco id="ARTDECO-DROPDOWN-TRIGGER_4">
              <svg id="svg_6">
                <path id="path_7" />
              </svg>
            </artdeco>
            <artdeco id="ARTDECO-DROPDOWN-CONTENT_8">
              <ul id="UL_9">
                <li id="LI_10">
                  <artdeco id="ARTDECO-DROPDOWN-ITEM_11">
                  </artdeco>
                </li>
                <li id="LI-ICON_12">
                  <svg id="svg_13">
                    <path id="path_14">
                    </path>
                  </svg>
                </li>
                <div id="DIV_15">
                  <span id="SPAN_16">Copy link to post</span>
                  <span id="SPAN_17" />
                </div>
              </ul>
            </artdeco>
            <artdeco id="ARTDECO-DROPDOWN-ITEM_19">
              <svg id="svg_21">
                <path id="path_22">
                </path>
              </svg>
              <div id="DIV_23">
                <span id="SPAN_24">Embed this post</span>
                <span id="SPAN_25">Copy and paste embed code on your site</span>
              </div>
            </artdeco>
            <artdeco id="ARTDECO-DROPDOWN-ITEM_27">
              <svg id="svg_29">
                <path id="path_30">
                </path>
              </svg>
              <div id="DIV_31">
                <span id="SPAN_32">Edit post</span>
                <span id="SPAN_33" />
              </div>
            </artdeco>
            <artdeco id="ARTDECO-DROPDOWN-ITEM_35">
              <svg id="svg_37">
                <path id="path_38">
                </path>
              </svg>
              <div id="DIV_39">
                <span id="SPAN_40">Delete post</span>
                <span id="SPAN_41" />
              </div>
            </artdeco>
            <artdeco id="ARTDECO-DROPDOWN-ITEM_43">
              <svg id="svg_45">
                <path id="path_46" />
              </svg>
              <div id="DIV_47">
                <span id="SPAN_48">Disable comments on this post</span>
                <span id="SPAN_49" />
              </div>
            </artdeco>
          </artdeco>
        </div>
        <div id="DIV_50">
          <div id="DIV_53">
            <div id="DIV_54">

              <div id="DIV_55">
                <div
                  id="DIV_56"
                  style={{ background: `rgba(0, 0, 0, 0) url("${userpic}") no-repeat scroll 50% 50% / cover padding-box content-box` }}
                >
                  <span id="SPAN_57">{name}</span>
                </div>
                <div id="DIV_58">
                  <span id="SPAN_59">Status is online</span>
                </div>
              </div>
            </div>
          </div>
          <div id="DIV_60">
            <a href="#" id="A_61" />
            <h3 id="H3_62">
              <span id="SPAN_63">
                <span id="SPAN_64">{name}</span>
              </span>
            </h3>
            <div id="DIV_66">
              <span id="SPAN_67">{headline || 'Your LinkedIn Headline'}</span>
            </div>
            <div id="DIV_69">
              <span id="SPAN_70"><span id="SPAN_71"><span id="SPAN_72">now</span></span></span>
            </div>
          </div>
        </div>
        <div id="DIV_73">
          <div id="DIV_74">
            <div id="DIV_75">
              <span id="SPAN_76"><span id="SPAN_77"><span id="SPAN_78">{description}</span></span></span>
            </div>
          </div>
        </div>
        <article id="ARTICLE_79">
          <div id="DIV_80">
            <div id="DIV_82">
              <div id="DIV_83">
                <div id="DIV_84">
                  <div
                    id="DIV_85"
                    style={{ background: `rgba(0, 0, 0, 0) url("${thumbnail}") repeat scroll center center / cover padding-box border-box` }}
                  />
                </div>
              </div>
            </div>
            <div id="DIV_86">
              <h2 id="H2_88">
                <span id="SPAN_89">{title}</span>
              </h2>
              <h3 id="H3_90">
                cdn.vidcloud.io
              </h3>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
};

LinkedinPostPreview.propTypes = {
  user: PropTypes.shape({
    name: PropTypes.string.isRequired,
    userpic: PropTypes.string.isRequired,
  }),
  post: PropTypes.shape({
    title: PropTypes.string.isRequired,
    thumbnail: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    link: PropTypes.string.isRequired,
  }),
};

export default LinkedinPostPreview;
