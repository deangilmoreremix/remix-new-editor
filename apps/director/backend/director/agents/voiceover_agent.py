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
from director.constants import DOWNLOADS_PATH

logger = logging.getLogger(__name__)

VOICEOVER_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to store output",
        },
        "video_id": {
            "type": "string",
            "description": "Video ID to add voiceover to",
        },
        "narration_text": {
            "type": "string",
            "description": "Text to convert to voiceover narration",
        },
        "voice_name": {
            "type": "string",
            "description": "Name of the voice to use for TTS",
            "default": "Rachel",
        },
        "volume": {
            "type": "number",
            "description": "Volume of the voiceover audio (0-1)",
            "default": 0.8,
        },
    },
    "required": ["collection_id", "video_id", "narration_text"],
}


class VoiceoverAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "voiceover"
        self.description = "Add AI-generated voiceover narration to a video"
        self.parameters = VOICEOVER_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_id: str,
        narration_text: str,
        voice_name: str = "Rachel",
        volume: float = 0.8,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Generate and overlay an AI voiceover onto a video.

        :param str collection_id: The collection ID to use.
        :param str video_id: The video ID to add the voiceover to.
        :param str narration_text: The text to synthesize into voiceover.
        :param str voice_name: The voice name for text-to-speech.
        :param float volume: Volume level for the voiceover.
        :return: The response with the new stream URL.
        :rtype: AgentResponse
        """
        try:
            self.videodb_tool = VideoDBTool(collection_id=collection_id)
            self.output_message.actions.append("Generating AI voiceover...")
            text_content = TextContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Synthesizing voiceover..",
            )
            self.output_message.content.append(text_content)
            self.output_message.push_update()

            audio_data = self.videodb_tool.generate_voice(
                text=narration_text,
                voice_name=voice_name,
                config={},
            )

            self.output_message.actions.append("Overlaying voiceover on video..")
            self.output_message.push_update()

            from videodb.editor import Timeline, Track, Clip, VideoAsset, AudioAsset

            timeline = Timeline(self.videodb_tool.conn)
            video_clip = Clip(asset=VideoAsset(id=video_id), duration=30)
            track = Track()
            track.add_clip(0, video_clip)

            audio_clip = Clip(
                asset=AudioAsset(id=audio_data["id"], start=0, volume=volume),
                duration=30,
            )
            audio_track = Track()
            audio_track.add_clip(0, audio_clip)

            timeline.add_track(track)
            timeline.add_track(audio_track)
            stream_url = timeline.generate_stream()

            text_content.text = "Voiceover generated and applied"
            text_content.status = MsgStatus.success
            text_content.status_message = "Voiceover ready"
            self.output_message.publish()

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Showing voiced video..",
            )
            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            self.output_message.content.append(video_content)
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            text_content.status = MsgStatus.error
            text_content.status_message = "Error generating voiceover."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Voiceover added to video successfully.",
            data={
                "stream_url": stream_url,
                "audio_id": audio_data["id"],
            },
        )
