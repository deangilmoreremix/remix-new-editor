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

logger = logging.getLogger(__name__)

HIGHLIGHT_REEL_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "video_id": {
            "type": "string",
            "description": "The video ID to create a highlight reel from",
        },
        "collection_id": {
            "type": "string",
            "description": "The collection ID containing the video",
        },
        "prompt": {
            "type": "string",
            "description": "Description of what constitutes a highlight. E.g., 'funny moments', 'key plays', 'emotional moments'",
        },
        "target_clips": {
            "type": "integer",
            "description": "Number of highlight clips to include in the reel",
            "default": 10,
        },
        "clip_duration": {
            "type": "integer",
            "description": "Duration of each highlight clip in seconds",
            "default": 5,
        },
        "background_music_audio_id": {
            "type": "string",
            "description": "Optional audio ID for background music. If not provided, no background music will be added",
            "default": None,
        },
    },
    "required": ["video_id", "collection_id", "prompt"],
}


class HighlightReelAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "highlight_reel"
        self.description = (
            "Automatically creates highlight reels from long videos using AI-powered "
            "scene detection and analysis. The agent indexes video scenes, uses an LLM "
            "to identify the most compelling moments based on your prompt, and compiles "
            "them into a punchy highlight video with smooth transitions. Perfect for "
            "sports, conferences, meetings, and long-form content."
        )
        self.parameters = HIGHLIGHT_REEL_AGENT_PARAMETERS
        self.llm = get_default_llm()
        super().__init__(session=session, **kwargs)

    def _index_scenes(self, video_id):
        self.output_message.actions.append("Indexing video scenes for highlight detection...")
        self.output_message.push_update()
        scene_index_id = self.videodb_tool.index_scene(
            video_id=video_id,
            extraction_type=SceneExtractionType.time_based,
            extraction_config={"time": 5, "frame_count": 3},
            prompt="""
            You are a highlight detector. Analyze this scene and determine if it contains a highlight moment.
            
            Respond with ONLY one of these:
            - "HIGHLIGHT" - if this scene contains an interesting, exciting, or important moment
            - "SKIP" - if this scene is routine, transitional, or low-interest
            
            Be generous with HIGHLIGHT - when in doubt, mark it as a highlight.
            """,
        )
        return scene_index_id

    def _get_scene_descriptions(self, video_id, scene_index_id):
        scenes = self.videodb_tool.get_scene_index(video_id=video_id, scene_id=scene_index_id)
        return scenes

    def _analyze_highlights(self, scenes, prompt, target_clips):
        self.output_message.actions.append("Analyzing scenes to find highlights...")
        self.output_message.push_update()

        scenes_text = json.dumps(scenes, indent=2)

        analysis_prompt = f"""
        You are a video editor tasked with creating a highlight reel.
        
        User's prompt for highlights: {prompt}
        Target number of clips: {target_clips}
        
        Here are the scenes from the video with timestamps and descriptions:
        {scenes_text}
        
        Your task:
        1. Identify the {target_clips} most compelling scenes that match the user's prompt
        2. Choose scenes that are spaced out throughout the video for good pacing
        3. Prefer scenes with clear visual action or emotional peaks
        4. Ensure each selected scene is at least 3 seconds long
        
        Return a JSON array of timestamps with this exact format:
        {{
            "highlights": [
                {{"start": 0.0, "end": 5.0, "reason": "brief explanation"}},
                ...
            ]
        }}
        
        Return ONLY the JSON array, no additional text.
        """

        message = ContextMessage(content=analysis_prompt, role=RoleTypes.user)
        llm_response = self.llm.chat_completions(
            [message.to_llm_msg()],
            response_format={"type": "json_object"},
        )

        try:
            result = json.loads(llm_response.content)
            return result.get("highlights", [])
        except Exception as e:
            logger.error(f"Failed to parse LLM response: {e}")
            return []

    def run(
        self,
        video_id: str,
        collection_id: str,
        prompt: str,
        target_clips: int = 10,
        clip_duration: int = 5,
        background_music_audio_id: str = None,
        *args,
        **kwargs,
    ) -> AgentResponse:
        try:
            self.videodb_tool = VideoDBTool(collection_id=collection_id)

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Creating highlight reel...",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            scene_index_id = self._index_scenes(video_id)
            scenes = self._get_scene_descriptions(video_id, scene_index_id)

            if not scenes:
                return AgentResponse(
                    status=AgentStatus.ERROR,
                    message="No scenes found. Please make sure the video is indexed.",
                )

            highlights = self._analyze_highlights(scenes, prompt, target_clips)

            if not highlights:
                return AgentResponse(
                    status=AgentStatus.ERROR,
                    message="No highlights found matching your prompt. Try a different description.",
                )

            self.output_message.actions.append(
                f"Found {len(highlights)} highlights. Compiling reel..."
            )
            self.output_message.push_update()

            timeline = Timeline(self.videodb_tool.conn)
            timeline.background = "#000000"

            video_track = Track()
            audio_track = Track()
            text_track = Track()

            current_time = 0
            for i, highlight in enumerate(highlights):
                start = max(0, float(highlight["start"]))
                end = float(highlight["end"])
                duration = min(clip_duration, end - start)

                video_clip = Clip(
                    asset=VideoAsset(id=video_id, start=start, volume=0.3),
                    duration=duration,
                    filter=Filter.contrast,
                    transition=Transition(in_="fade", out="fade", duration=0.8),
                )
                video_track.add_clip(current_time, video_clip)
                current_time += duration

            timeline.add_track(video_track)

            if background_music_audio_id:
                music_clip = Clip(
                    asset=AudioAsset(id=background_music_audio_id, start=0, volume=0.5),
                    duration=current_time,
                )
                audio_track.add_clip(0, music_clip)
                timeline.add_track(audio_track)

            intro_text = Clip(
                asset=TextAsset(
                    text="HIGHLIGHTS",
                    font=Font(family="Clear Sans", size=56, color="#FFFFFF"),
                ),
                duration=3,
                transition=Transition(in_="fade", out="fade", duration=0.5),
            )
            text_track.add_clip(0, intro_text)
            timeline.add_track(text_track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = f"Highlight reel with {len(highlights)} clips ready!"
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent: {e}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Failed to create highlight reel."
            self.output_message.publish()
            return AgentResponse(
                status=AgentStatus.ERROR, message=f"Failed to create highlight reel: {str(e)}"
            )

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message=f"Highlight reel created with {len(highlights)} clips.",
            data={
                "stream_url": stream_url,
                "highlights_count": len(highlights),
                "total_duration": current_time,
            },
        )
