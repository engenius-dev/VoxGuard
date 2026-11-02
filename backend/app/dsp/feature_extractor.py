import torch
import torch.nn.functional as functional
import torchaudio


class AudioFeatureExtractor:
    def __init__(self) -> None:
        self.mel_spectrogram = torchaudio.transforms.MelSpectrogram(
            sample_rate=16000,
            n_fft=512,
            hop_length=160,
            n_mels=80,
        )
        self.mfcc = torchaudio.transforms.MFCC(
            sample_rate=16000,
            n_mfcc=20,
        )

    def extract_log_mel_spectrogram(self, audio_tensor: torch.Tensor) -> torch.Tensor:
        audio = self._prepare_audio(audio_tensor, minimum_samples=512)
        spectrogram = self.mel_spectrogram(audio)
        log_spectrogram = torch.log(spectrogram + 1e-6)
        return log_spectrogram.unsqueeze(0).unsqueeze(0)

    def extract_mfcc(self, audio_tensor: torch.Tensor) -> torch.Tensor:
        audio = self._prepare_audio(audio_tensor, minimum_samples=512)
        mfcc_features = self.mfcc(audio)
        return mfcc_features.unsqueeze(0)

    @staticmethod
    def _prepare_audio(
        audio_tensor: torch.Tensor, minimum_samples: int
    ) -> torch.Tensor:
        if audio_tensor.ndim != 1:
            raise ValueError("Audio tensor must be one-dimensional")
        if audio_tensor.numel() == 0:
            raise ValueError("Audio tensor must not be empty")
        if not audio_tensor.is_floating_point():
            raise ValueError(
                "Audio tensor must contain normalized floating-point samples"
            )
        if not torch.isfinite(audio_tensor).all().item():
            raise ValueError("Audio tensor contains non-finite samples")

        if audio_tensor.numel() < minimum_samples:
            audio_tensor = functional.pad(
                audio_tensor, (0, minimum_samples - audio_tensor.numel())
            )
        return audio_tensor
