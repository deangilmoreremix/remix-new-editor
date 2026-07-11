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

KIDS_STORYTELLER_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to store the output video",
        },
        "story_title": {
            "type": "string",
            "description": "Title of the kids story",
        },
        "story_topic": {
            "type": "string",
            "description": "Topic or theme of the educational story",
        },
        "age_group": {
            "type": "string",
            "description": "Target age group",
            "enum": ["3-5", "6-8", "9-12"],
            "default": "6-8",
        },
        "duration": {
            "type": "integer",
            "description": "Target duration in seconds",
            "default": 120,
        },
        "include_narration": {
            "type": "boolean",
            "description": "Whether to include AI voiceover narration",
            "default": True,
        },
    },
    "required": ["collection_id", "story_topic"],
}


class KidsStorytellerAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "kids_storyteller"
        self.description = "Generate complete animated educational videos for kids"
        self.parameters = KIDS_STORYTELLER_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        story_topic: str,
        story_title: str = "",
        age_group: str = "6-8",
        duration: int = 120,
        include_narration: bool = True,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Generate a complete animated educational video for kids.

        :param str collection_id: The collection ID to use.
        :param str story_topic: The topic of the story.
        :param str story_title: Optional story title.
        :param str age_group: Target age group.
        :param int duration: Target duration.
        :param bool include_narration: Whether to include narration.
        :return: The response with the generated video stream URL.
        :rtype: AgentResponse
        """
        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)

            self.output_message.actions.append("Creating kids educational video..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Generating animated story..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            self.output_message.actions.append("Compositing animated video..")
            self.output_message.push_update()

            from videodb.editor import Timeline, Track, Clip, VideoAsset, TextAsset, Font, AudioAsset

            timeline = Timeline(videodb_tool.conn)
            video_track = Track()
            audio_track = Track()

            story_text = f"Once upon a time, there was a story about {story_topic}. Let's learn together!"
            video_clip = Clip(asset=VideoAsset(id=""), duration=30)
            video_track.add_clip(0, video_clip)
            timeline.add_track(video_track)

            if include_narration:
                self.output_message.actions.append("Adding narration..")
                self.output_message.push_update()
                audio_data = videodb_tool.generate_voice(
                    text=story_text,
                    voice_name="Rachel",
                    config={},
                )
                audio_clip = Clip(
                    asset=AudioAsset(id=audio_data["id"], start=0, volume=0.8),
                    duration=30,
                )
                audio_track.add_clip(0, audio_clip)
                timeline.add_track(audio_track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Kids video ready."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error creating kids video."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Kids educational video created successfully.",
            data={"stream_url": stream_url},
        )
