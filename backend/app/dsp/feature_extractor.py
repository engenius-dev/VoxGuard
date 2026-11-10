import torch
import torch.nn.functional as functional

class AudioFeatureExtractor:
    def __init__(self) -> None:
        # AASIST expects exactly 64,600 samples (approx 4 seconds at 16kHz)
        self.target_length = 64600

    def extract_raw_audio(self, audio_tensor: torch.Tensor) -> torch.Tensor:
        audio = self._prepare_audio(audio_tensor, minimum_samples=self.target_length)
        # AASIST expects shape: (batch_size, time_steps)
        return audio.unsqueeze(0)

    @staticmethod
    def _prepare_audio(audio_tensor: torch.Tensor, minimum_samples: int) -> torch.Tensor:
        if audio_tensor.ndim != 1:
            raise ValueError("Audio tensor must be one-dimensional")
        if not audio_tensor.is_floating_point():
            raise ValueError("Audio tensor must contain normalized floating-point samples")

        # Pad with zeros if the live buffer is too short, truncate if too long
        if audio_tensor.numel() < minimum_samples:
            padding = minimum_samples - audio_tensor.numel()
            audio_tensor = functional.pad(audio_tensor, (0, padding))
        elif audio_tensor.numel() > minimum_samples:
            audio_tensor = audio_tensor[:minimum_samples]
            
        return audio_tensor