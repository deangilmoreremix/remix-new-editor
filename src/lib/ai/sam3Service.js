/**
 * Server-side only. Do not import from client bundles.
 *
 * SAM-3 segmentation service wrapping fal.ai's `fal-ai/sam-3/image` model.
 * All keys are read from server-side environment variables; never expose
 * `FAL_KEY` to the browser.
 */

/**
 * Calls fal-ai/sam-3/image with the given parameters and returns the mask URL.
 *
 * @param {Object}   opts
 * @param {string}   opts.imageUrl   - Publicly reachable image URL to segment.
 * @param {string}   opts.promptType - One of: "text" | "click" | "box".
 * @param {string}   opts.prompt     - Text prompt (required for text/click).
 * @param {number[]} [opts.points]   - [x, y] point coords array (required for click).
 * @param {number[]} [opts.box]      - [x1, y1, x2, y2] bounding box (required for box).
 * @returns {{ maskUrl: string, raw: any }}
 * @throws {Error} for missing FAL_KEY, bad params, or API failures.
 */
export async function segmentImage({ imageUrl, promptType, prompt, points, box }) {
  const falKey = import.meta.env?.FAL_KEY;
  if (!falKey) {
    throw new Error("FAL_KEY is not configured on the server.");
  }

  const MODEL = "fal-ai/sam-3/image";
  const url = `https://fal.run/${MODEL}`;

  const input = { image: imageUrl };

  switch (promptType) {
    case "text":
      input.text_prompt = prompt;
      break;
    case "click": {
      if (!points || !Array.isArray(points) || points.length < 2) {
        throw new Error("click prompt requires at least one [x, y] point in `points`.");
      }
      input.point_coords = points;
      break;
    }
    case "box": {
      if (!box || !Array.isArray(box) || box.length !== 4) {
        throw new Error("box prompt requires a [x1, y1, x2, y2] array in `box`.");
      }
      input.box = box;
      break;
    }
    default:
      throw new Error(
        `Unsupported promptType "${promptType}". Expected text, click, or box.`
      );
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  });

  if (response.status === 429) {
    throw new Error("Rate limited by fal.ai. Please retry shortly.");
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `fal.ai API error ${response.status}: ${text.slice(0, 200)}`
    );
  }

  const result = await response.json();

  // fal-ai/sam-3/image returns { images: [{ url: "..." }], ... }
  const maskUrl =
    (result.images && result.images[0]?.url) ||
    (result.data && result.data.images?.[0]?.url) ||
    result.mask;

  if (!maskUrl) {
    throw new Error(
      "fal.ai response did not contain a mask URL. Raw: " +
        JSON.stringify(result).slice(0, 200)
    );
  }

  return { maskUrl, raw: result };
}
