import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    MsgStatus,
    VideoContent,
    VideoData,
    TextContent,
)
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

MEME_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "video_id": {
            "type": "string",
            "description": "Video ID to create meme from",
        },
        "top_text": {
            "type": "string",
            "description": "Top text for the meme overlay",
            "default": "",
        },
        "bottom_text": {
            "type": "string",
            "description": "Bottom text for the meme overlay",
            "default": "",
        },
        "font": {
            "type": "string",
            "description": "Font for meme text",
            "enum": ["impact", "arial", "helvetica", "comic_sans"],
            "default": "impact",
        },
        "text_color": {
            "type": "string",
            "description": "Color of the meme text",
            "default": "#FFFFFF",
        },
        "stroke_color": {
            "type": "string",
            "description": "Outline/stroke color of the meme text",
            "default": "#000000",
        },
        "font_size": {
            "type": "integer",
            "description": "Font size for meme text in pixels",
            "default": 48,
        },
    },
    "required": ["collection_id", "video_id"],
}


class MemeAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "meme"
        self.description = "Create meme videos with text overlays on top of video clips"
        self.parameters = MEME_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_id: str,
        top_text: str = "",
        bottom_text: str = "",
        font: str = "impact",
        text_color: str = "#FFFFFF",
        stroke_color: str = "#000000",
        font_size: int = 48,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Create a meme video with text overlays.

        :param str collection_id: The collection ID to use.
        :param str video_id: The video ID to meme-ify.
        :param str top_text: Top text overlay.
        :param str bottom_text: Bottom text overlay.
        :param str font: Font to use.
        :param str text_color: Text color.
        :param str stroke_color: Text stroke color.
        :param int font_size: Font size in pixels.
        :return: The response with the meme stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset, TextAsset, Font

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)
            video_info = videodb_tool.get_video(video_id)
            video_duration = video_info.get("length", 30)

            self.output_message.actions.append("Creating meme video..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Adding text overlays..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            timeline = Timeline(videodb_tool.conn)
            video_clip = Clip(asset=VideoAsset(id=video_id), duration=video_duration)
            track = Track()
            track.add_clip(0, video_clip)
            timeline.add_track(track)

            text_track = Track()
            font_obj = Font(family=font, size=font_size, color=text_color)
            if top_text:
                top_text_asset = TextAsset(
                    text=top_text,
                    font=font_obj,
                    x="center",
                    y="10%",
                    duration=video_duration,
                )
                text_track.add_clip(0, top_text_asset)
            if bottom_text:
                bottom_text_asset = TextAsset(
                    text=bottom_text,
                    font=font_obj,
                    x="center",
                    y="85%",
                    duration=video_duration,
                )
                text_track.add_clip(0, bottom_text_asset)

            if top_text or bottom_text:
                timeline.add_track(text_track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Meme video ready."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error creating meme."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Meme video created successfully.",
            data={"stream_url": stream_url},
        )
