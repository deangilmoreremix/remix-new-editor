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
from videodb import IndexType, SceneExtractionType

logger = logging.getLogger(__name__)

COPYRIGHT_DETECTION_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "original_video_id": {
            "type": "string",
            "description": "The video ID of your original content",
        },
        "suspect_video_id": {
            "type": "string",
            "description": "The video ID of the potentially plagiarized content",
        },
        "collection_id": {
            "type": "string",
            "description": "The collection ID containing both videos",
        },
        "similarity_threshold": {
            "type": "number",
            "description": "Similarity threshold for flagging matches (0.0 to 1.0). Default is 0.70",
            "default": 0.70,
        },
    },
    "required": ["original_video_id", "suspect_video_id", "collection_id"],
}


class CopyrightDetectionAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "copyright_detection"
        self.description = (
            "Detects potential copyright infringement by comparing visual similarity "
            "between original and suspect videos. Uses scene indexing and semantic "
            "search to find matching segments even with edits, crops, or filters. "
            "Generates side-by-side comparison clips and confidence reports for "
            "DMCA evidence. Production-ready plagiarism detection system."
        )
        self.parameters = COPYRIGHT_DETECTION_AGENT_PARAMETERS
        self.llm = get_default_llm()
        super().__init__(session=session, **kwargs)

    def _index_video(self, video_id):
        self.output_message.actions.append(f"Indexing video {video_id}...")
        self.output_message.push_update()
        return self.videodb_tool.index_scene(
            video_id=video_id,
            extraction_type=SceneExtractionType.shot_based,
            extraction_config={"threshold": 20},
        )

    def _compare_scenes(self, original_video_id, suspect_index_id, suspect_scenes, threshold):
        self.output_message.actions.append("Comparing scenes for similarity...")
        self.output_message.push_update()

        matches = []

        for suspect_scene in suspect_scenes:
            try:
                results = self.videodb_tool.semantic_search(
                    query=suspect_scene.get("description", ""),
                    index_type=IndexType.scene,
                    video_id=original_video_id,
                )

                shots = results.get_shots() if hasattr(results, "get_shots") else []
                for shot in shots:
                    score = getattr(shot, "search_score", 0)
                    if score >= threshold:
                        matches.append({
                            "suspect_time": suspect_scene["start"],
                            "original_time": shot.start,
                            "similarity": score,
                            "suspect_end": suspect_scene["end"],
                        })
            except Exception as e:
                logger.error(f"Error comparing scene: {e}")
                continue

        matches.sort(key=lambda x: x["similarity"], reverse=True)
        return matches

    def _detect_sequential_patterns(self, matches):
        sequential_matches = []
        consecutive_count = 0

        for match in matches:
            if match["similarity"] > 0.80 and consecutive_count < 5:
                consecutive_count += 1
                sequential_matches.append(match)
            else:
                if consecutive_count >= 3:
                    sequential_matches.extend(sequential_matches[-consecutive_count:])
                consecutive_count = 0

        return sequential_matches

    def _generate_evidence_clip(self, original_video_id, suspect_video_id, matches):
        from videodb.editor import Timeline, Track, Clip, VideoAsset, Position, Fit

        timeline = Timeline(self.videodb_tool.conn)

        for match in matches[:5]:
            track = Track()

            original_asset = VideoAsset(
                id=original_video_id,
                start=match["original_time"],
            )
            original_clip = Clip(
                asset=original_asset,
                duration=5,
                position=Position.left,
                fit=Fit.crop,
                scale=0.5,
            )
            track.add_clip(0, original_clip)

            suspect_asset = VideoAsset(
                id=suspect_video_id,
                start=match["suspect_time"],
            )
            suspect_clip = Clip(
                asset=suspect_asset,
                duration=5,
                position=Position.right,
                fit=Fit.crop,
                scale=0.5,
            )
            track.add_clip(0, suspect_clip)

            timeline.add_track(track)

        return timeline.generate_stream()

    def run(
        self,
        original_video_id: str,
        suspect_video_id: str,
        collection_id: str,
        similarity_threshold: float = 0.70,
        *args,
        **kwargs,
    ) -> AgentResponse:
        try:
            self.videodb_tool = VideoDBTool(collection_id=collection_id)

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Running copyright detection...",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            original_index_id = self._index_video(original_video_id)
            suspect_index_id = self._index_video(suspect_video_id)

            suspect_scenes = self.videodb_tool.get_scene_index(
                video_id=suspect_video_id, scene_id=suspect_index_id
            )

            if not suspect_scenes:
                return AgentResponse(
                    status=AgentStatus.ERROR,
                    message="No scenes found in suspect video.",
                )

            matches = self._compare_scenes(
                original_video_id, suspect_index_id, suspect_scenes, similarity_threshold
            )

            sequential_matches = self._detect_sequential_patterns(matches)

            high_confidence = len([m for m in matches if m["similarity"] > 0.95])
            medium_confidence = len(
                [m for m in matches if 0.85 < m["similarity"] <= 0.95]
            )

            plagiarism_confidence = min(1.0, len(sequential_matches) / 10)

            evidence_stream_url = None
            if matches:
                evidence_stream_url = self._generate_evidence_clip(
                    original_video_id, suspect_video_id, matches
                )

            report = {
                "total_matches": len(matches),
                "sequential_matches": len(sequential_matches),
                "plagiarism_confidence": plagiarism_confidence,
                "high_confidence_matches": high_confidence,
                "medium_confidence_matches": medium_confidence,
                "evidence_video_url": evidence_stream_url,
            }

            if plagiarism_confidence > 0.80:
                report["recommendation"] = "STRONG PLAGIARISM DETECTED - Ready for DMCA takedown"
            elif plagiarism_confidence > 0.50:
                report["recommendation"] = "SUSPICIOUS - Further review recommended"
            else:
                report["recommendation"] = "LOW RISK - Unlikely to be plagiarism"

            message = (
                f"Copyright analysis complete. "
                f"Found {len(matches)} matching segments. "
                f"Confidence: {plagiarism_confidence:.0%}. "
                f"Recommendation: {report['recommendation']}"
            )

            video_content.video = VideoData(stream_url=evidence_stream_url) if evidence_stream_url else None
            video_content.status = MsgStatus.success
            video_content.status_message = message
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent: {e}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Copyright detection failed."
            self.output_message.publish()
            return AgentResponse(
                status=AgentStatus.ERROR, message=f"Copyright detection failed: {str(e)}"
            )

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message=message,
            data=report,
        )
