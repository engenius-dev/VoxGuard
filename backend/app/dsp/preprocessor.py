import logging

import numpy as np
import torch


logger = logging.getLogger(__name__)


def pcm_to_normalized_tensor(
    pcm_bytes: bytes, sample_rate: int = 16000
) -> torch.Tensor:
    if sample_rate <= 0:
        raise ValueError("sample_rate must be a positive integer")
    if not pcm_bytes:
        raise ValueError("PCM audio data must not be empty")
    if len(pcm_bytes) % 2:
        raise ValueError("PCM data must contain complete 16-bit samples")

    pcm_samples = np.frombuffer(pcm_bytes, dtype="<i2")
    audio_tensor = torch.from_numpy(pcm_samples.copy()).to(dtype=torch.float32)
    audio_tensor.div_(32768.0)

    logger.info(
        "Converted PCM audio to a normalized tensor with %d samples at %d Hz",
        audio_tensor.numel(),
        sample_rate,
    )
    return audio_tensor
