from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class State(BaseModel):
    idx: int = Field(
        description="The index of the state in the trajectory sequence, starting from 0.",
    )

    cam_idx: int = Field(
        description="The index of the camera that this state belongs to.",
    )

    shot_idx: int = Field(
        description="The index of the shot that this state corresponds to.",
    )

    position: Optional[Dict[str, float]] = Field(
        default=None,
        description="The 3D position of the camera (x, y, z). Optional if not explicitly defined.",
    )

    rotation: Optional[Dict[str, float]] = Field(
        default=None,
        description="The rotation of the camera (pitch, yaw, roll). Optional if not explicitly defined.",
    )

    focal_length: Optional[float] = Field(
        default=None,
        description="The focal length of the camera lens in millimeters. Optional if not explicitly defined.",
    )

    shot_type: Optional[str] = Field(
        default=None,
        description="The type of the shot (e.g., wide shot, medium shot, close-up).",
    )

    active_shot_idxs: List[int] = Field(
        description="The indices of the shots that are active at this state.",
    )

    depends_on: List[int] = Field(
        default_factory=list,
        description="The indices of states that this state depends on. Empty list for root states.",
    )

    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata for the state (e.g., transition type, missing info).",
    )
