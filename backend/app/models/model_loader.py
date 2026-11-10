import logging
import threading
from pathlib import Path

import torch

from .AASIST import Model as AASISTModel

logger = logging.getLogger(__name__)


class ModelLoader:
    # Standard ASVspoof AASIST mapping: Index 0 = Spoof (Deepfake), Index 1 = Bonafide (Human)
    SPOOF_CLASS_INDEX = 0

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
        self.model: AASISTModel | None = None
        self._load_lock = threading.Lock()

    def load_model(self, weights_path: str | None = None) -> AASISTModel:
        with self._load_lock:
            if self.model is not None:
                return self.model

            config = {
                "architecture": "AASIST",
                "nb_samp": 64600,
                "first_conv": 128,
                "filts": [70, [1, 32], [32, 32], [32, 24], [24, 24]],
                "gat_dims": [24, 32],
                "pool_ratios": [0.4, 0.5, 0.7, 0.5],
                "temperatures": [2.0, 2.0, 100.0, 100.0],
            }

            model = AASISTModel(config)

            weights_directory = Path(__file__).resolve().parents[2] / "weights"
            if weights_path is not None:
                weights_candidates = [Path(weights_path)]
            else:
                weights_candidates = [
                    weights_directory / "AASIST-L.pth",
                    weights_directory / "aasist_lite.pt",
                ]

            resolved_weights_path = next(
                (path for path in weights_candidates if path.is_file()), None
            )
            if resolved_weights_path is None:
                expected_paths = ", ".join(str(path) for path in weights_candidates)
                raise FileNotFoundError(
                    f"AASIST model weights not found. Expected one of: {expected_paths}"
                )

            state_dict = torch.load(
                resolved_weights_path,
                map_location=self.device,
                weights_only=True,
            )
            model.load_state_dict(state_dict)
            logger.info("Loaded AASIST model weights from %s", resolved_weights_path)

            model.to(self.device)
            model.eval()
            self.model = model
            return model

    def predict(self, feature_tensor: torch.Tensor) -> float:
        model = self.load_model()
        with torch.no_grad():
            model_output = model(feature_tensor.to(self.device))
            logits = self._extract_logits(model_output)

            if logits.shape[0] != 1:
                raise ValueError("predict expects exactly one input sample")
            if not torch.isfinite(logits).all().item():
                raise ValueError("AASIST returned non-finite logits")
            probabilities = torch.softmax(logits, dim=-1)
            spoof_probability = probabilities[0, self.SPOOF_CLASS_INDEX]

        return float(spoof_probability.to(device="cpu").item())

    @staticmethod
    def _extract_logits(model_output: object) -> torch.Tensor:
        if isinstance(model_output, torch.Tensor):
            candidates = [model_output]
        elif isinstance(model_output, (tuple, list)):
            candidates = [
                output for output in model_output if isinstance(output, torch.Tensor)
            ]
        else:
            raise TypeError("AASIST model must return logits as a tensor or tuple")

        logits = [
            output
            for output in candidates
            if output.ndim == 2 and output.shape[-1] == 2
        ]
        if len(logits) != 1:
            raise ValueError(
                "Could not uniquely identify the two-class AASIST logits tensor"
            )
        return logits[0]

model_loader = ModelLoader()