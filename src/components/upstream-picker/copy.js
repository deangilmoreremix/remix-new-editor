// English copy from upstream Open-Generative-AI
// (packages/studio/src/messages/en/imageStudio.json and videoStudio.json),
// limited to the keys the model pickers read.

export const imageCopy = {
  "modelDropdown": {
    "categoryAll": "All",
    "categoryT2I": "Text to Image",
    "categoryI2I": "Image to Image",
    "allProviders": "All Providers",
    "searchPlaceholder": "Search models...",
    "modelsSuffix": "models",
    "noModelsFound": "No models found"
  },
  "popovers": {
    "model": "Model",
    "aspectRatio": "Aspect Ratio",
    "resolution": "Resolution",
    "effectType": "Effect Type"
  }
};

export const videoCopy = {
  "categories": {
    "all": "All",
    "t2v": "Text to Video",
    "i2v": "Image to Video",
    "v2v": "Video Tools"
  },
  "providers": {
    "allProviders": "All Providers"
  },
  "search": {
    "placeholder": "Search models..."
  },
  "dropdowns": {
    "model": "Model",
    "source": "Video mode",
    "baseGeneration": "Base generation",
    "aspectRatio": "Aspect Ratio",
    "effect": "Effect",
    "effectType": "Effect Type",
    "duration": "Duration",
    "resolution": "Resolution"
  },
  "seedance": {
    "speed": "Speed",
    "speeds": {
      "standard": "Standard speed",
      "fast": "Fast"
    },
    "tools": "Seedance video tools",
    "profiles": {
      "standard": {
        "label": "Standard",
        "description": ""
      },
      "intl": {
        "label": "International",
        "description": "International deployment."
      },
      "vip": {
        "label": "VIP",
        "description": "Priority processing."
      },
      "mini": {
        "label": "Mini",
        "description": "Lighter model."
      },
      "spicy": {
        "label": "Spicy",
        "description": "Bolder contrast and motion."
      },
      "mini_spicy": {
        "label": "Mini Spicy",
        "description": ""
      },
      "legacy": {
        "label": "Seedance 2.0 API",
        "description": ""
      },
      "legacy_new": {
        "label": "Seedance 2.0 New API",
        "description": ""
      }
    },
    "continueGenerated": "Continue a Seedance 2.0 result",
    "removeWatermark": "Remove watermark",
    "toolNames": {
      "continueGenerated": "Continue Seedance 2.0",
      "removeWatermark": "Remove watermark"
    },
    "toolVariants": {
      "standard": "Standard",
      "vip": "VIP",
      "pro": "Pro"
    },
    "editAudio": {
      "title": "New audio",
      "description": "Off keeps the original audio."
    }
  },
  "veo": {
    "speed": "Generation",
    "speeds": {
      "standard": "Standard",
      "fast": "Fast",
      "lite": "Lite"
    },
    "speedDescriptions": {
      "standard": "",
      "fast": "Faster generation.",
      "lite": "Lower cost."
    },
    "tools": "Veo video tools",
    "toolNames": {
      "continueGenerated": "Continue Veo 3.1",
      "upscale": "Create a 4K copy"
    },
    "toolsHelp": "Use a completed Veo 3.1 video.",
    "sourceVideo": "Source video",
    "sourceHelp": {
      "continueGenerated": "Create a 720p video with Veo 3.1 Standard or Fast first.",
      "upscale": "Create a video with Veo 3.1 Standard or Fast first."
    },
    "adjustments": {
      "speed": "Generation: {value}"
    }
  }
};
