import React, { useCallback } from "react";
import { FOOTER_HEIGHT, SIDE_PADDING } from "./layout";
import { useCaptionOverlay } from "./use-caption-overlay";

export const SubsEditorFooter: React.FC<{
  fileName: string;
}> = () => {
  const overlay = useCaptionOverlay();

  const onCloseSubEditor = useCallback(() => {
    overlay.setOpen(false);
  }, [overlay]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        height: FOOTER_HEIGHT,
        width: "100%",
        backgroundImage: "linear-gradient(rgba(255, 255, 255, 0), white 20%)",
        position: "absolute",
        bottom: 0,
        paddingTop: 20,
        paddingLeft: SIDE_PADDING,
        paddingRight: SIDE_PADDING,
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontFamily: "sans-serif",
          color: "gray",
          flex: 1,
        }}
      >
        Changes are saved automatically.
        <br />
        They are included the next time you render the video.
      </div>
      <div>
        <button
          style={{
            backgroundColor: "black",
            fontSize: 30,
            color: "white",
            borderRadius: 7,
            padding: "12px 30px",
            cursor: "pointer",
          }}
          type={"button"}
          onClick={onCloseSubEditor}
        >
          Done{" "}
          <kbd
            style={{
              color: "rgba(255, 255, 255, 0.4)",
              fontSize: "0.9em",
              marginLeft: 5,
            }}
          >
            Esc
          </kbd>
        </button>
      </div>
    </div>
  );
};
