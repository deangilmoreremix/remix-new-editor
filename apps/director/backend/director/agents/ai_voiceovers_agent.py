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

AI_VOICEOVERS_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "video_id": {
            "type": "string",
            "description": "Video ID to add voiceover to",
        },
        "script": {
            "type": "string",
            "description": "Narration script text",
        },
        "voice_name": {
            "type": "string",
            "description": "Name of the voice to use for TTS",
            "default": "Rachel",
        },
        "volume": {
            "type": "number",
            "description": "Volume of the voiceover (0-1)",
            "default": 0.8,
        },
        "start_time": {
            "type": "number",
            "description": "Start time in seconds for the voiceover",
            "default": 0,
        },
        "style": {
            "type": "string",
            "description": "Narration style",
            "enum": ["neutral", "dramatic", "professional", "friendly"],
            "default": "neutral",
        },
    },
    "required": ["collection_id", "video_id", "script"],
}


class AIVoiceoversAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "ai_voiceovers"
        self.description = "Add professional narration to silent footage"
        self.parameters = AI_VOICEOVERS_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_id: str,
        script: str,
        voice_name: str = "Rachel",
        volume: float = 0.8,
        start_time: float = 0,
        style: str = "neutral",
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Add a professional AI voiceover to a video.

        :param str collection_id: The collection ID to use.
        :param str video_id: The video ID to add voiceover to.
        :param str script: The narration script.
        :param str voice_name: The voice name.
        :param float volume: Volume level.
        :param float start_time: Start time for voiceover.
        :param str style: Narration style.
        :return: The response with the voiced stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset, AudioAsset

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)
            video_info = videodb_tool.get_video(video_id)
            video_duration = video_info.get("length", 30)

            self.output_message.actions.append("Generating AI voiceover..")
            text_content = TextContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Synthesizing voiceover..",
            )
            self.output_message.content.append(text_content)
            self.output_message.push_update()

            audio_data = videodb_tool.generate_voice(
                text=script,
                voice_name=voice_name,
                config={},
            )

            self.output_message.actions.append("Adding voiceover to video..")
            self.output_message.push_update()

            timeline = Timeline(videodb_tool.conn)
            video_clip = Clip(asset=VideoAsset(id=video_id), duration=video_duration)
            track = Track()
            track.add_clip(0, video_clip)
            timeline.add_track(track)

            audio_clip = Clip(
                asset=AudioAsset(id=audio_data["id"], start=start_time, volume=volume),
                duration=video_duration - start_time,
            )
            audio_track = Track()
            audio_track.add_clip(start_time, audio_clip)
            timeline.add_track(audio_track)

            stream_url = timeline.generate_stream()

            text_content.text = "AI voiceover added successfully"
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
            message="AI voiceover added successfully.",
            data={
                "stream_url": stream_url,
                "audio_id": audio_data["id"],
            },
        )
