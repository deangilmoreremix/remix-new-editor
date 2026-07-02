import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    MsgStatus,
    VideoContent,
    VideoData,
)
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

BRANDING_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "video_id": {
            "type": "string",
            "description": "The video ID to add branding to",
        },
        "collection_id": {
            "type": "string",
            "description": "The collection ID containing the video",
        },
        "logo_image_id": {
            "type": "string",
            "description": "Optional image ID of the logo/watermark to overlay on the video",
            "default": None,
        },
        "intro_video_id": {
            "type": "string",
            "description": "Optional video ID to prepend as intro sequence",
            "default": None,
        },
        "outro_video_id": {
            "type": "string",
            "description": "Optional video ID to append as outro sequence",
            "default": None,
        },
        "text_overlay": {
            "type": "string",
            "description": "Optional text overlay to display on the video",
            "default": None,
        },
        "text_position": {
            "type": "string",
            "description": "Position for text overlay: top, bottom, top_left, top_right, bottom_left, bottom_right, center",
            "enum": [
                "top",
                "bottom",
                "top_left",
                "top_right",
                "bottom_left",
                "bottom_right",
                "center",
            ],
            "default": "bottom",
        },
        "logo_position": {
            "type": "string",
            "description": "Position for logo overlay",
            "enum": [
                "top",
                "bottom",
                "top_left",
                "top_right",
                "bottom_left",
                "bottom_right",
                "center",
            ],
            "default": "top_right",
        },
        "logo_scale": {
            "type": "number",
            "description": "Scale factor for the logo (0.1 to 1.0). Default is 0.15",
            "default": 0.15,
        },
    },
    "required": ["video_id", "collection_id"],
}


class BrandingAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "branding"
        self.description = (
            "Adds professional brand elements to videos including logo watermarks, "
            "intro/outro sequences, and custom text overlays. Perfect for consistent "
            "branding across video content, marketing materials, and social media."
        )
        self.parameters = BRANDING_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def _position_to_enum(self, position_str):
        from videodb.editor import Position

        position_map = {
            "top": Position.top,
            "bottom": Position.bottom,
            "top_left": Position.top_left,
            "top_right": Position.top_right,
            "bottom_left": Position.bottom_left,
            "bottom_right": Position.bottom_right,
            "center": Position.center,
        }
        return position_map.get(position_str, Position.top_right)

    def run(
        self,
        video_id: str,
        collection_id: str,
        logo_image_id: str = None,
        intro_video_id: str = None,
        outro_video_id: str = None,
        text_overlay: str = None,
        text_position: str = "bottom",
        logo_position: str = "top_right",
        logo_scale: float = 0.15,
        *args,
        **kwargs,
    ) -> AgentResponse:
        try:
            self.videodb_tool = VideoDBTool(collection_id=collection_id)

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Adding brand elements...",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            from videodb.editor import (
                Timeline,
                Track,
                Clip,
                VideoAsset,
                ImageAsset,
                TextAsset,
                Font,
                Border,
                Background,
                Alignment,
                HorizontalAlignment,
                VerticalAlignment,
                Position,
                Offset,
                Fit,
            )

            timeline = Timeline(self.videodb_tool.conn)

            if intro_video_id:
                intro_track = Track()
                intro_asset = VideoAsset(id=intro_video_id, start=0)
                intro_clip = Clip(asset=intro_asset, duration=3)
                intro_track.add_clip(0, intro_clip)
                timeline.add_track(intro_track)

            video = self.videodb_tool.get_video(video_id)
            video_duration = float(video.get("length", 30))

            main_track = Track()
            if intro_video_id:
                main_start = 3
            else:
                main_start = 0

            video_asset = VideoAsset(id=video_id, start=0)
            video_clip = Clip(asset=video_asset, duration=video_duration)
            main_track.add_clip(main_start, video_clip)
            timeline.add_track(main_track)

            overlay_track = Track()

            if logo_image_id:
                logo_asset = ImageAsset(id=logo_image_id)
                logo_clip = Clip(
                    asset=logo_asset,
                    duration=video_duration,
                    fit=Fit.none,
                    scale=logo_scale,
                    position=self._position_to_enum(logo_position),
                    offset=Offset(x=-0.02, y=0.02),
                )
                overlay_track.add_clip(main_start, logo_clip)

            if text_overlay:
                text_asset = TextAsset(
                    text=text_overlay,
                    font=Font(family="Clear Sans", size=38, color="#FFFFFF"),
                    background=Background(color="#000000", border_width=2, opacity=0.7),
                    alignment=Alignment(
                        horizontal=HorizontalAlignment.center,
                        vertical=VerticalAlignment.center,
                    ),
                )
                text_clip = Clip(
                    asset=text_asset,
                    duration=video_duration,
                    position=self._position_to_enum(text_position),
                )
                overlay_track.add_clip(main_start, text_clip)

            timeline.add_track(overlay_track)

            if outro_video_id:
                outro_track = Track()
                outro_start = main_start + video_duration
                outro_asset = VideoAsset(id=outro_video_id, start=0)
                outro_clip = Clip(asset=outro_asset, duration=3)
                outro_track.add_clip(outro_start, outro_clip)
                timeline.add_track(outro_track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Brand elements added successfully!"
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent: {e}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Failed to add brand elements."
            self.output_message.publish()
            return AgentResponse(
                status=AgentStatus.ERROR,
                message=f"Failed to add brand elements: {str(e)}",
            )

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Brand elements added successfully.",
            data={"stream_url": stream_url},
        )
