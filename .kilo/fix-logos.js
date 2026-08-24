const fs = require("fs");
const files = [
  "src/components/AvatarStudio.js",
  "src/components/CharacterStudio.js",
  "src/components/ChatStudio.js",
  "src/components/CinemaTemplateStudio.js",
  "src/components/CommercialStudio.js",
  "src/components/ImageStudio.js",
  "src/components/LipSyncStudio.js",
  "src/components/StoryboardStudio.js",
  "src/components/TemplateStudio.js",
  "src/components/TrainingStudio.js",
  "src/components/UpscaleStudio.js",
  "src/components/VideoStudio.js",
  "src/components/VideoToolsStudio.js",
];
const pattern = /`renderProviderLogoImg\(provider, '', 'w-full h-full object-contain', invertLogos\.includes\(provider\) \? 'invert' : ''\)`/g;
const replacement = "renderProviderLogoImg(provider, '', 'w-full h-full object-contain', invertLogos.includes(provider) ? 'invert' : '')";
for (const f of files) {
  let content = fs.readFileSync(f, "utf8");
  const count = (content.match(pattern) || []).length;
  if (count > 0) {
    content = content.replace(pattern, replacement);
    fs.writeFileSync(f, content);
    console.log(f + ": fixed " + count);
  }
}
