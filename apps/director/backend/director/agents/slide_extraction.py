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
)
from director.tools.videodb_tool import VideoDBTool
from director.llm import get_default_llm
from videodb import SceneExtractionType

logger = logging.getLogger(__name__)

SLIDE_EXTRACTION_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "video_id": {
            "type": "string",
            "description": "The video ID to extract slides from",
        },
        "collection_id": {
            "type": "string",
            "description": "The collection ID containing the video",
        },
        "query": {
            "type": "string",
            "description": "Search query to find relevant slides. E.g., 'hard and fast rule', 'API review checklist'",
        },
        "scene_extraction_threshold": {
            "type": "integer",
            "description": "Threshold for scene extraction (lower = more scenes). Default is 10 for presentations",
            "default": 10,
        },
    },
    "required": ["video_id", "collection_id", "query"],
}


class SlideExtractionAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "slide_extraction"
        self.description = (
            "Extracts and searches slide content from presentation or lecture videos. "
            "Combines spoken word search with visual scene indexing to find the exact "
            "slide content shown when specific topics are discussed. Perfect for "
            "conference talks, educational lectures, and business presentations."
        )
        self.parameters = SLIDE_EXTRACTION_AGENT_PARAMETERS
        self.llm = get_default_llm()
        super().__init__(session=session, **kwargs)

    def _ensure_indexed(self, video_id):
        try:
            self.videodb_tool.get_transcript(video_id, text=False)
        except Exception:
            self.output_message.actions.append("Indexing spoken words...")
            self.output_message.push_update()
            self.videodb_tool.index_spoken_words(video_id)

    def _get_or_create_scene_index(self, video_id, threshold):
        scene_list = self.videodb_tool.list_scene_index(video_id)
        if scene_list:
            return scene_list[0]["scene_index_id"]

        self.output_message.actions.append("Creating scene index for slide detection...")
        self.output_message.push_update()
        scene_index_id = self.videodb_tool.index_scene(
            video_id=video_id,
            extraction_type=SceneExtractionType.shot_based,
            extraction_config={"threshold": threshold},
            prompt="""
            Give the content written on the slides or screen.
            Output None if there is no slide or screen content visible.
            Be precise and extract the actual text/content shown.
            """,
        )
        return scene_index_id

    def _search_pipeline(self, video_id, query, scene_index_id):
        from videodb import IndexType, SearchType

        self.output_message.actions.append(f"Searching for: {query}")
        self.output_message.push_update()

        search_result = self.videodb_tool.semantic_search(
            query=query,
            index_type=IndexType.spoken_word,
            video_id=video_id,
        )

        try:
            shots = search_result.get_shots()
            time_ranges = [(shot.start, shot.end) for shot in shots]
        except Exception:
            time_ranges = []

        scenes = self.videodb_tool.get_scene_index(
            video_id=video_id, scene_id=scene_index_id
        )

        for scene in scenes:
            scene["start"] = float(scene["start"])
            scene["end"] = float(scene["end"])

        def is_in_range(scene, range_start, range_end):
            return (
                (range_start <= scene["start"] <= range_end)
                or (range_start <= scene["end"] <= range_end)
                or (scene["start"] <= range_start and scene["end"] >= range_end)
            )

        filtered_scenes = []
        for start, end in time_ranges:
            filtered_scenes.extend(
                [scene for scene in scenes if is_in_range(scene, start, end)]
            )

        seen = set()
        unique_scenes = []
        for scene in filtered_scenes:
            key = (scene["start"], scene["end"], scene.get("description", ""))
            if key not in seen:
                seen.add(key)
                unique_scenes.append(scene)

        result_text = "\n\n".join(
            scene["description"]
            for scene in unique_scenes
            if scene.get("description", "").lower().strip() != "none"
        )
        result_timeline = [
            (scene["start"], scene["end"]) for scene in unique_scenes
        ]

        return result_text, result_timeline

    def run(
        self,
        video_id: str,
        collection_id: str,
        query: str,
        scene_extraction_threshold: int = 10,
        *args,
        **kwargs,
    ) -> AgentResponse:
        try:
            self.videodb_tool = VideoDBTool(collection_id=collection_id)

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Extracting slides...",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            self._ensure_indexed(video_id)
            scene_index_id = self._get_or_create_scene_index(video_id, scene_extraction_threshold)

            result_text, result_timeline = self._search_pipeline(
                video_id, query, scene_index_id
            )

            if result_timeline:
                stream_url = self.videodb_tool.generate_video_stream(
                    video_id=video_id, timeline=result_timeline
                )
                video_content.video = VideoData(stream_url=stream_url)
                video_content.status = MsgStatus.success
                video_content.status_message = "Slides extracted successfully!"
                self.output_message.publish()

                return AgentResponse(
                    status=AgentStatus.SUCCESS,
                    message="Slide content extracted successfully.",
                    data={
                        "stream_url": stream_url,
                        "slide_content": result_text,
                        "timeline": result_timeline,
                    },
                )
            else:
                return AgentResponse(
                    status=AgentStatus.ERROR,
                    message=f"No slides found matching query: {query}",
                )

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent: {e}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Failed to extract slides."
            self.output_message.publish()
            return AgentResponse(
                status=AgentStatus.ERROR, message=f"Failed to extract slides: {str(e)}"
            )
