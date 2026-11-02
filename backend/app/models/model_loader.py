import logging
import threading
from pathlib import Path

import torch

from .aasist import AASISTLite


logger = logging.getLogger(__name__)


class ModelLoader:
    _instance: "ModelLoader | None" = None
    _instance_lock = threading.Lock()

    def __new__(cls) -> "ModelLoader":
        with cls._instance_lock:
            if cls._instance is None:
                instance = super().__new__(cls)
                instance._initialize_state()
                cls._instance = instance
            return cls._instance

    def _initialize_state(self) -> None:
        self.device: torch.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )
        self.model: AASISTLite | None = None
        self._load_lock = threading.Lock()

    def load_model(self, weights_path: str | None = None) -> AASISTLite:
        with self._load_lock:
            if self.model is not None:
                return self.model

            model = AASISTLite()
            resolved_weights_path = (
                Path(weights_path)
                if weights_path is not None
                else Path(__file__).resolve().parents[2]
                / "weights"
                / "aasist_lite.pt"
            )

            if resolved_weights_path.is_file():
                if resolved_weights_path.suffix.lower() != ".pt":
                    raise ValueError("Model weights must be a .pt file")
                state_dict = torch.load(
                    resolved_weights_path,
                    map_location=self.device,
                    weights_only=True,
                )
                if not isinstance(state_dict, dict):
                    raise ValueError("Model weights file must contain a state dict")
                model.load_state_dict(state_dict)
            else:
                logger.warning(
                    "Model weights not found at %s; using initialized weights",
                    resolved_weights_path,
                )

            model.to(self.device)
            model.eval()
            self.model = model
            return model

    def predict(self, feature_tensor: torch.Tensor) -> float:
        model = self.load_model()
        with torch.no_grad():
            score = model(feature_tensor.to(self.device)).detach().to("cpu")

        if score.numel() != 1:
            raise ValueError(
                "predict expects a feature tensor containing exactly one sample"
            )
        return float(score.item())


model_loader = ModelLoader()
