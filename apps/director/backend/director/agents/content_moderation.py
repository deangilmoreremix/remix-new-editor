import logging
import json

from videodb import SearchType, IndexType, SceneExtractionType

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    ContextMessage,
    RoleTypes,
    MsgStatus,
    VideoContent,
    VideoData,
)
from director.tools.videodb_tool import VideoDBTool
from director.llm import get_default_llm

logger = logging.getLogger(__name__)

CONTENT_MODERATION_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "video_id": {
            "type": "string",
            "description": "The video ID to moderate",
        },
        "collection_id": {
            "type": "string",
            "description": "The collection ID containing the video",
        },
        "moderation_prompt": {
            "type": "string",
            "description": "Custom moderation criteria. If not provided, uses default safety guidelines",
            "default": None,
        },
        "scene_threshold": {
            "type": "integer",
            "description": "Scene extraction threshold (lower = more granular). Default is 5",
            "default": 5,
        },
    },
    "required": ["video_id", "collection_id"],
}

DEFAULT_MODERATION_PROMPT = """
You are a Content Moderator. Analyze the visual content for inappropriate elements:
1. Violence (fighting, hitting, shooting)
2. Weapons (guns, knives)
3. Blood or Gore
4. Drug use
5. Sexual content

If ANY of these are detected, your response must start with:
"CONTENT_UNSAFE: [brief reason]"

If the scene is clean and safe, your response must start with:
"CONTENT_SAFE: [brief description]"
"""


class ContentModerationAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "content_moderation"
        self.description = (
            "AI-powered visual content moderation using scene indexing. Analyzes video "
            "frames for inappropriate content (violence, weapons, blood, drugs, sexual "
            "content) and generates a clean version that skips flagged segments. Uses "
            "prompt-based filtering with no external APIs required. Perfect for family-friendly "
            "streaming, educational platforms, and content compliance."
        )
        self.parameters = CONTENT_MODERATION_AGENT_PARAMETERS
        self.llm = get_default_llm()
        super().__init__(session=session, **kwargs)

    def _index_with_moderation_prompt(self, video_id, moderation_prompt, scene_threshold):
        self.output_message.actions.append("Indexing scenes with moderation prompt...")
        self.output_message.push_update()

        scene_index_id = self.videodb_tool.index_scene(
            video_id=video_id,
            extraction_type=SceneExtractionType.time_based,
            extraction_config={"time": scene_threshold, "frame_count": 3},
            prompt=moderation_prompt,
        )
        return scene_index_id

    def _filter_safe_content(self, video_id, scene_index_id):
        self.output_message.actions.append("Filtering safe content...")
        self.output_message.push_update()

        safe_results = self.videodb_tool.semantic_search(
            query="CONTENT_SAFE",
            index_type=IndexType.scene,
            video_id=video_id,
        )

        try:
            shots = safe_results.get_shots()
            timeline = [(shot.start, shot.end) for shot in shots]
        except Exception:
            timeline = []

        return timeline

    def run(
        self,
        video_id: str,
        collection_id: str,
        moderation_prompt: str = None,
        scene_threshold: int = 5,
        *args,
        **kwargs,
    ) -> AgentResponse:
        try:
            self.videodb_tool = VideoDBTool(collection_id=collection_id)

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Moderating content...",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            prompt = moderation_prompt or DEFAULT_MODERATION_PROMPT

            scene_index_id = self._index_with_moderation_prompt(
                video_id, prompt, scene_threshold
            )
            timeline = self._filter_safe_content(video_id, scene_index_id)

            if not timeline:
                return AgentResponse(
                    status=AgentStatus.ERROR,
                    message="No safe content segments found. The video may contain inappropriate content throughout.",
                )

            stream_url = self.videodb_tool.generate_video_stream(
                video_id=video_id, timeline=timeline
            )

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Content moderation complete. Safe version ready!"
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent: {e}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Content moderation failed."
            self.output_message.publish()
            return AgentResponse(
                status=AgentStatus.ERROR, message=f"Content moderation failed: {str(e)}"
            )

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Content moderated successfully. Inappropriate segments removed.",
            data={
                "stream_url": stream_url,
                "safe_segments_count": len(timeline),
            },
        )
