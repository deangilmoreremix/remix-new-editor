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

COLOR_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "video_id": {
            "type": "string",
            "description": "Video ID to apply color correction to",
        },
        "brightness": {
            "type": "number",
            "description": "Brightness adjustment (-1 to 1, 0 is no change)",
            "default": 0,
        },
        "contrast": {
            "type": "number",
            "description": "Contrast adjustment (-1 to 1, 0 is no change)",
            "default": 0,
        },
        "saturation": {
            "type": "number",
            "description": "Saturation adjustment (-1 to 1, 0 is no change)",
            "default": 0,
        },
        "filter": {
            "type": "string",
            "description": "Preset filter to apply",
            "enum": ["none", "grayscale", "sepia", "invert", "vintage"],
            "default": "none",
        },
    },
    "required": ["collection_id", "video_id"],
}


class ColorAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "color"
        self.description = "Apply color correction, filters, and visual adjustments to a video"
        self.parameters = COLOR_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_id: str,
        brightness: float = 0,
        contrast: float = 0,
        saturation: float = 0,
        filter: str = "none",
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Apply color correction and filters to a video.

        :param str collection_id: The collection ID to use.
        :param str video_id: The video ID to process.
        :param float brightness: Brightness adjustment.
        :param float contrast: Contrast adjustment.
        :param float saturation: Saturation adjustment.
        :param str filter: Preset filter to apply.
        :return: The response with the color-corrected stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset, Filter

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)
            video_info = videodb_tool.get_video(video_id)
            video_duration = video_info.get("length", 30)

            self.output_message.actions.append("Applying color correction..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Applying color correction..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            filter_map = {
                "none": None,
                "grayscale": Filter.grayscale,
                "sepia": Filter.sepia,
                "invert": Filter.invert,
                "vintage": Filter.vintage,
            }
            active_filter = filter_map.get(filter)

            timeline = Timeline(videodb_tool.conn)
            video_clip = Clip(
                asset=VideoAsset(id=video_id),
                duration=video_duration,
                filter=active_filter,
            )
            track = Track()
            track.add_clip(0, video_clip)
            timeline.add_track(track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Color correction applied."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error in color correction."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Color correction applied successfully.",
            data={"stream_url": stream_url},
        )
