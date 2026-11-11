export type NicheConfig = {
  id: string;
  label: string;
  heading: string;
  subtext: string;
  ctaHeading: string;
  ctaBody: string;
  ctaButton: string;
  studioTab: string;
};

export const NICHE_CONTENT: NicheConfig[] = [
  {
    id: 'ecommerce',
    label: 'Ecommerce & Products',
    heading: 'Turn One Product Into an Entire Video Campaign',
    subtext:
      'Start with a product photo or idea and turn it into attention-grabbing product demos, UGC-style ads, cinematic commercials, vertical social videos, promotional clips, and branded visuals. See a style you like? Use it as your starting point and create your own version with SmartVideo GO AI.',
    ctaHeading: 'Personalize This AI Product Video Demo',
    ctaBody:
      'You’re looking at an <strong>AI ecommerce product video demo</strong>. Upload your photo, product image, or brand asset and see how this style can be transformed into a personalized product promotion for you, your business, or a client.',
    ctaButton: 'Personalize This Product Demo',
    studioTab: 'marketing',
  },
  {
    id: 'restaurants-food',
    label: 'Restaurants & Food',
    heading: 'Create Food Videos That Stop the Scroll',
    subtext:
      'Turn meals, drinks, restaurants, menus, and food brands into videos people want to watch. Create sizzling food promos, restaurant ads, menu showcases, chef content, social clips, and cinematic food scenes without organizing a traditional video shoot.',
    ctaHeading: 'Personalize This AI Restaurant & Food Video Demo',
    ctaBody:
      'You’re watching an <strong>AI restaurant and food promotional video demo</strong>. Upload your image or brand asset and see how this exact video style could become a personalized promotion for your restaurant, food business, offer, or client.',
    ctaButton: 'Personalize This Food Demo',
    studioTab: 'marketing',
  },
  {
    id: 'real-estate',
    label: 'Real Estate',
    heading: 'Turn Properties Into Videos Buyers Want to Explore',
    subtext:
      'Create property showcases, agent introductions, luxury listing promos, neighborhood videos, lifestyle scenes, and social content without starting from a blank screen. Find a look you like, personalize it, and turn it into your own real estate video.',
    ctaHeading: 'Personalize This AI Real Estate Video Demo',
    ctaBody:
      'You’re watching an <strong>AI property and real estate marketing video demo</strong>. Upload your image and see yourself — or your client — transformed into the agent, presenter, or face behind the property campaign.',
    ctaButton: 'Personalize This Real Estate Demo',
    studioTab: 'video',
  },
  {
    id: 'beauty',
    label: 'Beauty, Skincare & Fashion',
    heading: 'Create Beauty Content That Looks Ready for a Campaign',
    subtext:
      'Create skincare promos, product demonstrations, makeup content, beauty transformations, fashion clips, influencer-style videos, and product launches using AI. Start with the examples that catch your eye and remix the style for your own brand.',
    ctaHeading: 'Personalize This AI Beauty & Skincare Video Demo',
    ctaBody:
      'You’re watching an <strong>AI beauty, skincare, and product video demo</strong>. Upload your image or product and see how this style can become a personalized campaign featuring you, your brand, or your customer.',
    ctaButton: 'Personalize This Beauty Demo',
    studioTab: 'marketing',
  },
  {
    id: 'wellness-fitness',
    label: 'Fitness, Wellness & Coaching',
    heading: 'Turn Your Ideas Into Fitness Content People Want to Follow',
    subtext:
      'Create workout demonstrations, fitness promos, wellness tips, motivational clips, coaching content, transformation videos, and personal-brand content without spending every day in front of a camera.',
    ctaHeading: 'Personalize This AI Fitness & Wellness Video Demo',
    ctaBody:
      'You’re watching an <strong>AI fitness, trainer, and wellness video demo</strong>. Upload your photo and see how you can become the trainer, coach, athlete, or wellness expert inside this style of video.',
    ctaButton: 'Personalize This Fitness Demo',
    studioTab: 'video',
  },
  {
    id: 'education',
    label: 'Education & Training',
    heading: 'Turn What You Know Into Videos People Actually Want to Watch',
    subtext:
      'Create explainers, tutorials, course videos, training clips, lesson content, onboarding videos, and educational social posts. Start with an example instead of staring at a blank prompt and build your own version from there.',
    ctaHeading: 'Personalize This AI Education & Training Video Demo',
    ctaBody:
      'You’re watching an <strong>AI educational lesson and instructor video demo</strong>. Upload your photo and see yourself transformed into the instructor, teacher, coach, or presenter delivering the lesson.',
    ctaButton: 'Personalize This Education Demo',
    studioTab: 'video',
  },
  {
    id: 'technology',
    label: 'Technology, SaaS & Apps',
    heading: 'Show People What Your Product Does — Without a Complicated Production',
    subtext:
      'Create SaaS demos, app promotions, product explainers, feature announcements, launch videos, AI technology promos, and branded social content. Find the video style that fits your product, then customize it instead of building everything from scratch.',
    ctaHeading: 'Personalize This AI SaaS & Technology Video Demo',
    ctaBody:
      'You’re watching an <strong>AI SaaS, software, and technology product demo</strong>. Upload your image and see yourself presenting the product, introducing a feature, announcing an update, or promoting your technology.',
    ctaButton: 'Personalize This Tech Demo',
    studioTab: 'marketing',
  },
  {
    id: 'finance',
    label: 'Finance & Professional Services',
    heading: 'Turn Expertise Into Professional Video Content',
    subtext:
      'Create financial explainers, business updates, educational videos, service promotions, commentary, authority content, and client-facing videos without needing a studio or production team.',
    ctaHeading: 'Personalize This AI Finance & Expert Video Demo',
    ctaBody:
      'You’re watching an <strong>AI finance and professional-services video demo</strong>. Upload your image and see yourself transformed into the expert, advisor, host, or presenter inside the video.',
    ctaButton: 'Personalize This Finance Demo',
    studioTab: 'video',
  },
  {
    id: 'entertainment-media',
    label: 'Entertainment, Media & Creators',
    heading: 'Create the Kind of Video People Stop to Watch',
    subtext:
      'Experiment with cinematic scenes, creator videos, promos, short-form stories, character content, social clips, music visuals, and entertainment concepts. Find something that sparks an idea, remix it, and make it your own.',
    ctaHeading: 'Personalize This AI Entertainment & Creator Video Demo',
    ctaBody:
      'You’re watching an <strong>AI entertainment and creator video demo</strong>. Upload your photo and see yourself become the character, creator, host, spokesperson, or personality inside this visual style.',
    ctaButton: 'Personalize This Entertainment Demo',
    studioTab: 'cinema',
  },
  {
    id: 'automotive',
    label: 'Automotive',
    heading: 'Turn Any Vehicle Into a Scroll-Stopping Showcase',
    subtext:
      'Create vehicle reveals, dealership promos, feature showcases, luxury car videos, social ads, walkaround-style content, and cinematic automotive scenes without organizing a full vehicle shoot.',
    ctaHeading: 'Personalize This AI Automotive Video Demo',
    ctaBody:
      'You’re watching an <strong>AI automotive showcase and dealership video demo</strong>. Upload your image and see yourself — or your client — become the presenter or spokesperson inside the video.',
    ctaButton: 'Personalize This Automotive Demo',
    studioTab: 'video',
  },
  {
    id: 'travel-hospitality',
    label: 'Travel, Hotels & Hospitality',
    heading: 'Turn Destinations Into Videos That Make People Want to Go',
    subtext:
      'Create destination promos, hotel showcases, resort videos, travel clips, property tours, experience videos, and social content designed to sell the feeling of being there.',
    ctaHeading: 'Personalize This AI Travel & Hospitality Video Demo',
    ctaBody:
      'You’re watching an <strong>AI travel, hotel, and destination video demo</strong>. Upload your image and see yourself become the guide, host, traveler, spokesperson, or face of the experience.',
    ctaButton: 'Personalize This Travel Demo',
    studioTab: 'video',
  },
  {
    id: 'sports-outdoors',
    label: 'Sports & Outdoors',
    heading: 'Turn the Energy of the Moment Into Video',
    subtext:
      'Create sports promos, athlete content, outdoor adventures, gear videos, training clips, action scenes, event content, and high-energy social videos using AI-generated styles and examples as your starting point.',
    ctaHeading: 'Personalize This AI Sports & Outdoor Video Demo',
    ctaBody:
      'You’re watching an <strong>AI sports, athlete, and outdoor video demo</strong>. Upload your photo and see yourself become the athlete, creator, trainer, or personality inside the action.',
    ctaButton: 'Personalize This Sports Demo',
    studioTab: 'video',
  },
  {
    id: 'general-business',
    label: 'Business & More',
    heading: 'See an Idea. Make It Yours. Create the Video.',
    subtext:
      'SmartVideo GO AI gives you more ways to start than a blank prompt. Explore business videos, service promotions, spokesperson content, social ads, product demos, explainers, personal-brand videos, client campaigns, and creative styles across industries. Find the example that matches what you want to create, then use it as the starting point for your own video.',
    ctaHeading: 'Personalize This AI Business Video Demo',
    ctaBody:
      'You’re watching an <strong>AI business and promotional video demo</strong>. Upload your image or brand asset and see how the example can be transformed into a personalized video for you, your company, your offer, or your client.',
    ctaButton: 'Personalize This Business Demo',
    studioTab: 'video',
  },
  {
    id: 'viral-trending',
    label: 'Viral & Trending',
    heading: 'See What’s Possible. Remix the Style. Make It Yours.',
    subtext:
      'Explore attention-grabbing AI video concepts, cinematic effects, social styles, creative transitions, character videos, and visual ideas designed to get you creating faster. Instead of wondering what to type into an AI video generator, start with something you can actually see — then recreate the style for yourself.',
    ctaHeading: 'Personalize This Viral AI Video Demo',
    ctaBody:
      'You’re watching a <strong>viral-style AI social video demo</strong>. Upload your photo and see yourself transformed into the character, creator, presenter, or subject inside this exact style.',
    ctaButton: 'Personalize This Trending Demo',
    studioTab: 'video',
  },
];
