// Prerender plugin for landing page SEO
// Injects static HTML content into the landing page for search engine crawlers
// that don't execute JavaScript.

export function prerenderLandingPage() {
  return {
    name: 'prerender-landing-page',
    transformIndexHtml(html) {
      // Prerendered landing page content for SEO
      // This content is visible to search engine crawlers
      const prerenderedContent = `
    <!-- Prerendered landing page content for SEO -->
    <div style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;" aria-hidden="true">
      <h1>SmartVideo — AI Video Generation Studio</h1>
      <h2>Create Anything. Sell Everything.</h2>
      <p>Create professional images, videos, ads, characters, commercials and social content with AI.</p>
      <h3>AI Creative Platform</h3>
      <ul>
        <li><strong>200+</strong> AI Models</li>
        <li><strong>33</strong> Professional Studios</li>
      </ul>
      <h2>AI Video Generation Studio</h2>
      <p>AI Video Agency Studio gives you a complete creative command center with 60+ AI-powered tools for generating videos, images, characters, commercials, cinematic effects, avatars, lip sync, dubbing, storyboards, edits, workflows, agents, and client-ready content packages — all from one organized platform.</p>
      <h3>Platform Features</h3>
      <ul>
        <li>33 AI Creative Apps</li>
        <li>60+ AI Features</li>
        <li>200+ AI Models</li>
        <li>Lifetime Access</li>
      </ul>
      <h3>Available Studios</h3>
      <ul>
        <li>Image - Generate high-quality AI images for ads, thumbnails, product visuals, social media, websites, and client campaigns.</li>
        <li>Video - Create text-to-video, image-to-video, video-to-video, and cinematic motion content for social, ads, and branded campaigns.</li>
        <li>Cinema Studio - Direct AI-generated scenes using cinematic camera language, lenses, moods, lighting, motion, shot types, and visual styles.</li>
        <li>Character - Create consistent AI characters, branded personas, story characters, spokespersons, creators, and campaign personalities.</li>
        <li>Influencer - Create AI influencer visuals, social content concepts, creator-style campaigns, fashion shots, lifestyle scenes, and branded posts.</li>
        <li>Storyboard - Plan campaigns, commercials, short films, social videos, and client projects using AI-assisted scene and shot planning.</li>
        <li>Effects - Apply creative effects, transformations, motion styles, cinematic treatments, and stylized visual looks.</li>
        <li>Edit - Edit, revise, enhance, repurpose, and improve visual assets so users can move from raw AI output to polished delivery.</li>
        <li>Upscale - Improve image and video quality with AI upscaling for sharper, cleaner, more professional-looking assets.</li>
        <li>Audio - Generate, enhance, transform, or prepare audio assets for videos, voiceovers, ads, explainers, and AI content.</li>
        <li>Avatar - Create AI avatar-based content, virtual presenters, branded spokespersons, personality-driven videos, and talking visuals.</li>
        <li>Commercial - Create product commercials, brand ads, local business promos, ecommerce videos, launch videos, and agency-ready ad concepts.</li>
        <li>Templates - Start faster with prebuilt creative templates for ads, thumbnails, products, social posts, cinematic shots, VFX, and more.</li>
        <li>Explore - Browse creative ideas, examples, presets, templates, use cases, visual styles, and production inspiration.</li>
        <li>Library - Store, organize, reuse, and manage generated assets, projects, videos, images, templates, and campaign materials.</li>
        <li>Community - Showcase examples, discover creative workflows, highlight user creations, and build a community around AI video creation.</li>
      </ul>
      <p>Start creating with SmartVideo today — the free, open-source AI video generation studio.</p>
    </div>`;

      // Insert before closing body tag
      return html.replace('</body>', `${prerenderedContent}\n  </body>`);
    },
  };
}
