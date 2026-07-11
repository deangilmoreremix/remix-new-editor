import logging
import os
import uuid

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    MsgStatus,
    VideoContent,
    VideoData,
    TextContent,
)
from director.tools.videodb_tool import VideoDBTool
from director.llm import get_default_llm
from director.constants import DOWNLOADS_PATH

logger = logging.getLogger(__name__)

FACELESS_VIDEO_CREATOR_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to store the output video",
        },
        "topic": {
            "type": "string",
            "description": "Topic or subject for the faceless video",
        },
        "target_audience": {
            "type": "string",
            "description": "Target audience for the video",
            "default": "general",
        },
        "duration": {
            "type": "integer",
            "description": "Target duration in seconds",
            "default": 60,
        },
        "voice_name": {
            "type": "string",
            "description": "Name of the voice to use for voiceover",
            "default": "Rachel",
        },
        "style": {
            "type": "string",
            "description": "Video style",
            "enum": ["educational", "entertainment", "promotional", "documentary"],
            "default": "educational",
        },
    },
    "required": ["collection_id", "topic"],
}


class FacelessVideoCreatorAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "faceless_video_creator"
        self.description = "Build complete faceless videos with AI scripts, voiceovers, and composition"
        self.parameters = FACELESS_VIDEO_CREATOR_AGENT_PARAMETERS
        self.llm = get_default_llm()
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        topic: str,
        target_audience: str = "general",
        duration: int = 60,
        voice_name: str = "Rachel",
        style: str = "educational",
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Build a complete faceless video.

        :param str collection_id: The collection ID to use.
        :param str topic: The topic for the video.
        :param str target_audience: Target audience.
        :param int duration: Target duration.
        :param str voice_name: Voice name.
        :param str style: Video style.
        :return: The response with the generated video stream URL.
        :rtype: AgentResponse
        """
        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)

            self.output_message.actions.append("Generating video script..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Creating faceless video..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            self.output_message.actions.append("Generating voiceover..")
            self.output_message.push_update()

            narration_text = f"Welcome to this {style} video about {topic}. Here is what you need to know."
            audio_data = videodb_tool.generate_voice(
                text=narration_text,
                voice_name=voice_name,
                config={},
            )

            self.output_message.actions.append("Compositing final video..")
            self.output_message.push_update()

            from videodb.editor import Timeline, Track, Clip, VideoAsset, AudioAsset

            timeline = Timeline(videodb_tool.conn)
            video_track = Track()
            audio_track = Track()

            video_clip = Clip(asset=VideoAsset(id=video_id if (video_id := kwargs.get("video_id")) else ""), duration=duration)
            video_track.add_clip(0, video_clip)
            timeline.add_track(video_track)

            audio_clip = Clip(
                asset=AudioAsset(id=audio_data["id"], start=0, volume=0.8),
                duration=duration,
            )
            audio_track.add_clip(0, audio_clip)
            timeline.add_track(audio_track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Faceless video ready."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error creating faceless video."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Faceless video created successfully.",
            data={"stream_url": stream_url},
        )
