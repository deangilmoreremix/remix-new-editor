import type React from "react";
import { useProjectId } from "../../../studio/project-context";
import { AbsoluteFill } from "remotion";
import { MONOSPACE_FONT, REGULAR_FONT } from "../../../config/fonts";
import { COLORS } from "../../../config/themes";

const container: React.CSSProperties = {
  ...REGULAR_FONT,
  fontSize: 36,
  padding: 60,
  flexDirection: "column",
  lineHeight: 1.5,
  width: 1080,
  margin: "auto",
  justifyContent: "center",
};

const accent: React.CSSProperties = {
  ...MONOSPACE_FONT,
  color: COLORS.light.ACCENT_COLOR,
};

const link: React.CSSProperties = {
  color: COLORS.light.ACCENT_COLOR,
  borderBottom: "4px solid " + COLORS.light.ACCENT_COLOR,
  textDecoration: "none",
};

export const NoRecordingsScene: React.FC<{ type: "none" | "no-more" }> = ({
  type,
}) => {
  const id = useProjectId();

  return (
    <AbsoluteFill style={container}>
      <p>
        This is a video scene but there are no{" "}
        {type === "no-more" ? "more" : null} recordings in the
        <span style={accent}> {id} </span>
        project.
      </p>
      <br />
      <div>Possible solutions:</div>
      <ol>
        <li>
          Make a new recording in the <span style={link}>Record</span> tab
          or import a video in <span style={link}>Takes</span>.
        </li>
        <li>
          Switch this scene to a different type, e.g.{" "}
          <code style={accent}>&quot;title&quot;</code>
        </li>
        <li>Delete this scene.</li>
      </ol>
    </AbsoluteFill>
  );
};
