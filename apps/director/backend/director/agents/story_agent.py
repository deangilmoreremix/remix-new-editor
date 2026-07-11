import logging
import json

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    ContextMessage,
    RoleTypes,
    MsgStatus,
    VideoContent,
    VideoData,
    TextContent,
)
from director.tools.videodb_tool import VideoDBTool
from director.llm import get_default_llm

logger = logging.getLogger(__name__)

STORY_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID containing the video clips",
        },
        "video_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of video IDs to build a story from",
        },
        "story_prompt": {
            "type": "string",
            "description": "Prompt describing the narrative or story to build",
        },
        "background_music_audio_id": {
            "type": "string",
            "description": "Optional audio ID for background music",
            "default": None,
        },
    },
    "required": ["collection_id", "video_ids", "story_prompt"],
}


class StoryAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "story"
        self.description = "Build a narrative story from multiple video clips arranged by LLM"
        self.parameters = STORY_AGENT_PARAMETERS
        self.llm = get_default_llm()
        super().__init__(session=session, **kwargs)

    def _get_transcript(self, videodb_tool, video_id):
        try:
            return videodb_tool.get_transcript(video_id, text=False)
        except Exception:
            videodb_tool.index_spoken_words(video_id)
            return videodb_tool.get_transcript(video_id, text=False)

    def _order_clips(self, video_ids, story_prompt):
        transcripts = {}
        for vid in video_ids:
            try:
                transcripts[vid] = self.videodb_tool.get_video(vid).get("name", "")
            except Exception:
                transcripts[vid] = ""

        ordering_prompt = f"""
You are a narrative video editor. Given a set of video clips, arrange them into a coherent story
based on the user's prompt. Return the ordered list of video IDs.

User prompt: {story_prompt}

Available videos:
{json.dumps([{"video_id": vid, "name": transcripts[vid]} for vid in video_ids], indent=2)}

Return ONLY a JSON array of video IDs in the desired order:
{{"ordered_video_ids": ["video_id_1", "video_id_2", ...]}}
"""
        message = ContextMessage(content=ordering_prompt, role=RoleTypes.user)
        llm_response = self.llm.chat_completions(
            [message.to_llm_msg()],
            response_format={"type": "json_object"},
        )
        try:
            result = json.loads(llm_response.content)
            return result.get("ordered_video_ids", video_ids)
        except Exception:
            return video_ids

    def run(
        self,
        collection_id: str,
        video_ids: list,
        story_prompt: str,
        background_music_audio_id: str = None,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Build a narrative story video from a set of clips.

        :param str collection_id: The collection ID to use.
        :param list[str] video_ids: List of video IDs to include.
        :param str story_prompt: Prompt for the narrative story.
        :param str background_music_audio_id: Optional audio ID for bg music.
        :return: The response with the story stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset, AudioAsset, TextAsset, Font

        try:
            self.videodb_tool = VideoDBTool(collection_id=collection_id)

            self.output_message.actions.append("Building narrative story..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Building story..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            self.output_message.actions.append("Ordering clips by narrative..")
            self.output_message.push_update()
            ordered_video_ids = self._order_clips(video_ids, story_prompt)

            timeline = Timeline(self.videodb_tool.conn)
            timeline.background = "#000000"
            video_track = Track()
            audio_track = Track()
            text_track = Track()

            current_time = 0
            for idx, vid in enumerate(ordered_video_ids):
                video_info = self.videodb_tool.get_video(vid)
                video_duration = video_info.get("length", 30)

                video_clip = Clip(
                    asset=VideoAsset(id=vid),
                    duration=video_duration,
                )
                video_track.add_clip(current_time, video_clip)

                intro_text = Clip(
                    asset=TextAsset(
                        text=f"Chapter {idx + 1}",
                        font=Font(family="Arial", size=40, color="#FFFFFF"),
                    ),
                    duration=2,
                )
                text_track.add_clip(current_time, intro_text)
                current_time += video_duration

            timeline.add_track(video_track)
            timeline.add_track(text_track)

            if background_music_audio_id:
                music_clip = Clip(
                    asset=AudioAsset(id=background_music_audio_id, start=0, volume=0.5),
                    duration=current_time,
                )
                audio_track.add_clip(0, music_clip)
                timeline.add_track(audio_track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Story ready."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error building story."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Narrative story built successfully.",
            data={"stream_url": stream_url, "clip_order": ordered_video_ids},
        )
