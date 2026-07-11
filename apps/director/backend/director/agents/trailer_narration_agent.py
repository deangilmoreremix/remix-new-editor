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

TRAILER_NARRATION_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "video_id": {
            "type": "string",
            "description": "Video ID to add trailer narration to",
        },
        "narration_text": {
            "type": "string",
            "description": "Dramatic narration text to add to the trailer",
        },
        "voice_name": {
            "type": "string",
            "description": "Name of the voice to use for TTS",
            "default": "Deep Male",
        },
        "volume": {
            "type": "number",
            "description": "Volume of the narration audio (0-1)",
            "default": 0.8,
        },
        "start_time": {
            "type": "number",
            "description": "Start time in seconds for the narration",
            "default": 0,
        },
    },
    "required": ["collection_id", "video_id", "narration_text"],
}


class TrailerNarrationAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "trailer_narration"
        self.description = "Add dramatic narration to trailer videos"
        self.parameters = TRAILER_NARRATION_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_id: str,
        narration_text: str,
        voice_name: str = "Deep Male",
        volume: float = 0.8,
        start_time: float = 0,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Add dramatic narration to a trailer video.

        :param str collection_id: The collection ID to use.
        :param str video_id: The video ID to add narration to.
        :param str narration_text: The narration text.
        :param str voice_name: The voice name for TTS.
        :param float volume: Volume level.
        :param float start_time: Start time for narration.
        :return: The response with the narrated stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset, AudioAsset

        try:
            self.videodb_tool = VideoDBTool(collection_id=collection_id)
            video_info = self.videodb_tool.get_video(video_id)
            video_duration = video_info.get("length", 30)

            self.output_message.actions.append("Generating trailer narration..")
            text_content = TextContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Synthesizing narration..",
            )
            self.output_message.content.append(text_content)
            self.output_message.push_update()

            audio_data = self.videodb_tool.generate_voice(
                text=narration_text,
                voice_name=voice_name,
                config={},
            )

            self.output_message.actions.append("Adding narration to trailer..")
            self.output_message.push_update()

            timeline = Timeline(self.videodb_tool.conn)
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

            text_content.text = "Trailer narration added successfully"
            text_content.status = MsgStatus.success
            text_content.status_message = "Narration ready"
            self.output_message.publish()

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Showing narrated trailer..",
            )
            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            self.output_message.content.append(video_content)
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            text_content.status = MsgStatus.error
            text_content.status_message = "Error adding trailer narration."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Trailer narration added successfully.",
            data={
                "stream_url": stream_url,
                "audio_id": audio_data["id"],
            },
        )
